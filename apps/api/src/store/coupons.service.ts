import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type Coupon, type OrderStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { CouponDto } from "./coupon.dto";
import { evaluateCoupon, normalizeCouponCode, type CouponResult } from "./coupon-rules";

// Cancelled and refunded orders give their coupon use back.
const FREED: OrderStatus[] = ["CANCELLED", "REFUNDED"];

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async evaluate(codeRaw: string, subtotalPaise: number, userId?: string, db: Db = this.prisma): Promise<{ coupon: Coupon; result: CouponResult } | null> {
    const coupon = await db.coupon.findUnique({ where: { code: normalizeCouponCode(codeRaw) } });
    if (!coupon) return null;
    const used = { couponId: coupon.id, status: { notIn: FREED } } satisfies Prisma.OrderWhereInput;
    const [usedTotal, usedByUser, ordersBefore] = await Promise.all([
      coupon.usageLimit !== null ? db.order.count({ where: used }) : 0,
      userId && coupon.perUserLimit !== null ? db.order.count({ where: { ...used, userId } }) : 0,
      userId && coupon.firstOrderOnly ? db.order.count({ where: { userId, status: { notIn: FREED } } }) : 0,
    ]);
    return { coupon, result: evaluateCoupon(coupon, { subtotalPaise, now: new Date(), usedTotal, usedByUser, userId, ordersBefore }) };
  }

  // Personal codes a customer can still use.
  async mine(userId: string) {
    const now = new Date();
    const coupons = await this.prisma.coupon.findMany({
      where: { userId, active: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }], AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }] },
      orderBy: { createdAt: "desc" },
    });
    const used = await this.prisma.order.groupBy({ by: ["couponId"], where: { userId, couponId: { in: coupons.map((c) => c.id) }, status: { notIn: FREED } }, _count: { _all: true } });
    const count = new Map(used.map((u) => [u.couponId, u._count._all]));
    return coupons
      .filter((c) => c.perUserLimit === null || (count.get(c.id) ?? 0) < c.perUserLimit)
      .map((c) => ({ code: c.code, description: c.description, type: c.type, value: c.value, minOrderPaise: c.minOrderPaise, maxDiscountPaise: c.maxDiscountPaise, endsAt: c.endsAt }));
  }

  async list() {
    const [coupons, counts] = await Promise.all([
      this.prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, include: { user: { select: { name: true, email: true, phone: true } } } }),
      this.prisma.order.groupBy({ by: ["couponId"], where: { couponId: { not: null }, status: { notIn: FREED } }, _count: { _all: true }, _sum: { discountPaise: true } }),
    ]);
    const byId = new Map(counts.map((c) => [c.couponId, c]));
    return coupons.map((c) => ({ ...c, timesUsed: byId.get(c.id)?._count._all ?? 0, discountGivenPaise: byId.get(c.id)?._sum.discountPaise ?? 0 }));
  }

  async create(dto: CouponDto) {
    const data = await this.data(dto);
    return this.prisma.coupon.create({ data }).catch((e) => { throw this.mapError(e); });
  }

  async update(id: string, dto: CouponDto) {
    const existing = await this.prisma.coupon.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) throw new NotFoundException();
    const data = await this.data(dto, existing.userId);
    return this.prisma.coupon.update({ where: { id }, data }).catch((e) => { throw this.mapError(e); });
  }

  // Finds the customer a personal code is for, by email or mobile number.
  private async customerId(ref: string): Promise<string> {
    const text = ref.trim();
    const phone = text.replace(/[\s()-]/g, "").replace(/^\+?91(?=\d{10}$)/, "");
    const user = await this.prisma.user.findFirst({ where: { OR: [{ email: { equals: text, mode: "insensitive" } }, { phone: { in: [phone, `+91${phone}`] } }] }, select: { id: true } });
    if (!user) throw new BadRequestException("No customer has that email or mobile number");
    return user.id;
  }

  async remove(id: string) {
    await this.prisma.coupon.delete({ where: { id } }).catch((e) => { throw this.mapError(e); });
    return { ok: true };
  }

  // `current` is the customer the code is already tied to, kept when the form does not mention one.
  private async data(dto: CouponDto, current: string | null = null): Promise<Prisma.CouponUncheckedCreateInput> {
    if (dto.type === "PERCENT" && dto.value > 100) throw new BadRequestException("A percentage discount cannot be more than 100");
    if (dto.startsAt && dto.endsAt && new Date(dto.endsAt) <= new Date(dto.startsAt)) throw new BadRequestException("The end date must be after the start date");
    const userId = dto.customer === undefined ? current : dto.customer.trim() ? await this.customerId(dto.customer) : null;
    return {
      userId, firstOrderOnly: dto.firstOrderOnly ?? false,
      code: normalizeCouponCode(dto.code), description: dto.description?.trim() || null, type: dto.type, value: dto.value,
      minOrderPaise: dto.minOrderPaise ?? 0, maxDiscountPaise: dto.type === "PERCENT" ? dto.maxDiscountPaise ?? null : null,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null, endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      usageLimit: dto.usageLimit ?? null, perUserLimit: dto.perUserLimit ?? (userId ? 1 : null), active: dto.active ?? true,
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
