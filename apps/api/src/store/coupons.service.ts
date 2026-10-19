import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type Coupon, type OrderStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { CouponDto } from "./coupon.dto";
import { evaluateCoupon, normalizeCouponCode, type CouponResult } from "./coupon-rules";
import { identityMatches, identityOf, type Identity } from "./identity";

// Cancelled and refunded orders give their coupon use back; an order waiting for payment holds it until it expires.
export const FREED: OrderStatus[] = ["CANCELLED", "REFUNDED"];

type Db = PrismaService | Prisma.TransactionClient;

export interface EvaluateOptions {
  // The phone number given for delivery, which counts as part of the buyer's identity.
  shipPhone?: string;
  // Holds the coupon row until the surrounding transaction ends, so two orders at once cannot both take the last use.
  lock?: boolean;
}

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  // Who is buying: the account plus the email and phone keys other orders are matched by. Null when the account is gone.
  async identity(userId: string, shipPhone?: string | null, db: Db = this.prisma): Promise<Identity | null> {
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, phone: true } });
    return user ? identityOf(user, shipPhone) : null;
  }

  async evaluate(codeRaw: string, subtotalPaise: number, userId?: string, db: Db = this.prisma, opts: EvaluateOptions = {}): Promise<{ coupon: Coupon; result: CouponResult } | null> {
    const code = normalizeCouponCode(codeRaw);
    if (opts.lock) await db.$queryRaw`SELECT "id" FROM "Coupon" WHERE "code" = ${code} FOR UPDATE`;
    const coupon = await db.coupon.findUnique({ where: { code }, include: { customers: { select: { userId: true } } } });
    if (!coupon) return null;
    const who = userId ? await this.identity(userId, opts.shipPhone, db) : null;
    const used = { couponId: coupon.id, status: { notIn: FREED } } satisfies Prisma.OrderWhereInput;
    const [usedTotal, usedByUser, usedByIdentity, ordersBefore] = await Promise.all([
      coupon.usageLimit !== null ? db.order.count({ where: used }) : 0,
      who && coupon.perUserLimit !== null ? db.order.count({ where: { ...used, userId: who.userId } }) : 0,
      who && coupon.perUserLimit !== null ? db.order.count({ where: { ...used, OR: identityMatches(who) } }) : 0,
      who && coupon.firstOrderOnly ? db.order.count({ where: { status: { notIn: FREED }, OR: identityMatches(who) } }) : 0,
    ]);
    const customerIds = coupon.customers.map((c) => c.userId);
    return { coupon, result: evaluateCoupon({ ...coupon, customerIds }, { subtotalPaise, now: new Date(), usedTotal, usedByUser, usedByIdentity, userId, ordersBefore }) };
  }

  // Codes this shopper could use on this cart, for the cart and the progress bar: shown ones that are live, not used up, not used by this person
  // (account, email or phone) and meant for them. A code whose minimum order is not reached yet is listed as locked, with how much more to spend.
  async offers(userId: string | undefined, subtotalPaise: number) {
    const now = new Date();
    const rows = await this.prisma.coupon.findMany({
      where: { active: true, visible: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }], AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }] },
      include: { customers: { select: { userId: true } } }, orderBy: [{ minOrderPaise: "asc" }, { createdAt: "asc" }], take: 50,
    });
    const candidates = rows.filter((c) => c.customers.length === 0 || (!!userId && c.customers.some((x) => x.userId === userId)));
    if (candidates.length === 0) return [];

    const who = userId ? await this.identity(userId) : null;
    const used = { couponId: { in: candidates.map((c) => c.id) }, status: { notIn: FREED } } satisfies Prisma.OrderWhereInput;
    const [totals, mine, ordersBefore] = await Promise.all([
      this.prisma.order.groupBy({ by: ["couponId"], where: used, _count: { _all: true } }),
      who ? this.prisma.order.groupBy({ by: ["couponId"], where: { ...used, OR: identityMatches(who) }, _count: { _all: true } }) : [],
      who && candidates.some((c) => c.firstOrderOnly) ? this.prisma.order.count({ where: { status: { notIn: FREED }, OR: identityMatches(who) } }) : 0,
    ]);
    const totalOf = new Map(totals.map((t) => [t.couponId, t._count._all]));
    const mineOf = new Map(mine.map((t) => [t.couponId, t._count._all]));

    const offers = [];
    for (const c of candidates) {
      const byPerson = mineOf.get(c.id) ?? 0;
      const result = evaluateCoupon({ ...c, customerIds: c.customers.map((x) => x.userId) }, { subtotalPaise, now, usedTotal: totalOf.get(c.id) ?? 0, usedByUser: byPerson, usedByIdentity: byPerson, userId, ordersBefore });
      const locked = !result.ok && subtotalPaise < c.minOrderPaise && result.reason.startsWith("Add ");
      if (!result.ok && !locked) continue;
      offers.push({
        code: c.code, description: c.description, type: c.type, value: c.value, minOrderPaise: c.minOrderPaise, maxDiscountPaise: c.maxDiscountPaise, endsAt: c.endsAt,
        unlocked: result.ok, discountPaise: result.ok ? result.discountPaise : 0, remainingPaise: result.ok ? 0 : c.minOrderPaise - subtotalPaise,
      });
    }
    return offers.slice(0, 8);
  }

  // Codes made for this customer that they can still use.
  async mine(userId: string) {
    const now = new Date();
    const coupons = await this.prisma.coupon.findMany({
      where: { customers: { some: { userId } }, active: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }], AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }] },
      orderBy: { createdAt: "desc" },
    });
    const who = await this.identity(userId);
    const used = who
      ? await this.prisma.order.groupBy({ by: ["couponId"], where: { couponId: { in: coupons.map((c) => c.id) }, status: { notIn: FREED }, OR: identityMatches(who) }, _count: { _all: true } })
      : [];
    const count = new Map(used.map((u) => [u.couponId, u._count._all]));
    return coupons
      .filter((c) => c.perUserLimit === null || (count.get(c.id) ?? 0) < c.perUserLimit)
      .map((c) => ({ code: c.code, description: c.description, type: c.type, value: c.value, minOrderPaise: c.minOrderPaise, maxDiscountPaise: c.maxDiscountPaise, endsAt: c.endsAt }));
  }

  async list() {
    const [coupons, counts] = await Promise.all([
      this.prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, include: { customers: { select: { user: { select: { id: true, name: true, email: true, phone: true } } } } } }),
      this.prisma.order.groupBy({ by: ["couponId"], where: { couponId: { not: null }, status: { notIn: FREED } }, _count: { _all: true }, _sum: { discountPaise: true, rewardDiscountPaise: true } }),
    ]);
    const byId = new Map(counts.map((c) => [c.couponId, c]));
    return coupons.map((c) => ({ ...c, customers: c.customers.map((x) => x.user), timesUsed: byId.get(c.id)?._count._all ?? 0, discountGivenPaise: (byId.get(c.id)?._sum.discountPaise ?? 0) - (byId.get(c.id)?._sum.rewardDiscountPaise ?? 0) }));
  }

  // Every order that used the code, newest first, with whether it still counts against the limits.
  async usage(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id }, select: { id: true } });
    if (!coupon) throw new NotFoundException();
    const orders = await this.prisma.order.findMany({
      where: { couponId: id }, orderBy: { createdAt: "desc" }, take: 200,
      select: { id: true, status: true, createdAt: true, discountPaise: true, rewardDiscountPaise: true, totalPaise: true, shippingAddr: true, user: { select: { id: true, name: true, email: true, phone: true } } },
    });
    return orders.map((o) => ({
      orderId: o.id, status: o.status, createdAt: o.createdAt, discountPaise: o.discountPaise - o.rewardDiscountPaise, totalPaise: o.totalPaise,
      counted: !FREED.includes(o.status), customer: o.user, deliveryPhone: (o.shippingAddr as { phone?: string } | null)?.phone ?? null,
    }));
  }

  async create(dto: CouponDto) {
    const { data, customerIds } = await this.data(dto);
    return this.prisma.coupon.create({ data: { ...data, customers: { create: customerIds.map((userId) => ({ userId })) } } }).catch((e) => { throw this.mapError(e); });
  }

  async update(id: string, dto: CouponDto) {
    const existing = await this.prisma.coupon.findUnique({ where: { id }, select: { customers: { select: { userId: true } } } });
    if (!existing) throw new NotFoundException();
    const { data, customerIds } = await this.data(dto, existing.customers.map((c) => c.userId));
    const customers = dto.customers === undefined ? undefined : { deleteMany: {}, create: customerIds.map((userId) => ({ userId })) };
    return this.prisma.coupon.update({ where: { id }, data: { ...data, customers } }).catch((e) => { throw this.mapError(e); });
  }

  // Finds the customers a code is for, from emails or mobile numbers separated by commas, semicolons or new lines.
  private async customerIds(text: string): Promise<string[]> {
    const refs = [...new Set(text.split(/[\n,;]+/).map((r) => r.trim()).filter(Boolean))];
    if (refs.length > 100) throw new BadRequestException("A code can be made for up to 100 customers");
    const ids = new Set<string>();
    const missing: string[] = [];
    for (const ref of refs) {
      const phone = ref.replace(/[\s()-]/g, "").replace(/^\+?91(?=\d{10}$)/, "");
      const user = await this.prisma.user.findFirst({ where: { deletedAt: null, OR: [{ email: { equals: ref, mode: "insensitive" } }, { phone: { in: [phone, `+91${phone}`] } }] }, select: { id: true } });
      if (user) ids.add(user.id); else missing.push(ref);
    }
    if (missing.length) throw new BadRequestException(`No customer has that email or mobile number: ${missing.join(", ")}`);
    return [...ids];
  }

  // A code that has been used keeps its history: deleting it would let the same code be made again and used a second time.
  async remove(id: string) {
    if (await this.prisma.order.count({ where: { couponId: id } })) throw new ConflictException("This code has been used on orders, so it can't be deleted. Switch it off instead.");
    await this.prisma.coupon.delete({ where: { id } }).catch((e) => { throw this.mapError(e); });
    return { ok: true };
  }

  // `current` are the customers the code is already tied to, kept when the form does not mention any.
  private async data(dto: CouponDto, current: string[] = []): Promise<{ data: Omit<Prisma.CouponUncheckedCreateInput, "customers">; customerIds: string[] }> {
    if (dto.type === "PERCENT" && dto.value > 100) throw new BadRequestException("A percentage discount cannot be more than 100");
    if (dto.startsAt && dto.endsAt && new Date(dto.endsAt) <= new Date(dto.startsAt)) throw new BadRequestException("The end date must be after the start date");
    const customerIds = dto.customers === undefined ? current : dto.customers.trim() ? await this.customerIds(dto.customers) : [];
    return {
      customerIds,
      data: {
        firstOrderOnly: dto.firstOrderOnly ?? false, visible: dto.visible ?? true,
        code: normalizeCouponCode(dto.code), description: dto.description?.trim() || null, type: dto.type, value: dto.value,
        minOrderPaise: dto.minOrderPaise ?? 0, maxDiscountPaise: dto.type === "PERCENT" ? dto.maxDiscountPaise ?? null : null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null, endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        usageLimit: dto.usageLimit ?? null, perUserLimit: dto.perUserLimit ?? (customerIds.length ? 1 : null), active: dto.active ?? true,
      },
    };
  }

  private mapError(e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return new ConflictException("A coupon with this code already exists");
      if (e.code === "P2025") return new NotFoundException();
    }
    return e;
  }
}
