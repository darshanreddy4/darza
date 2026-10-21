import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma, ReturnStatus } from "@prisma/client";
import { MailService } from "../mail/mail.service";
import { returnMail, type ReturnMailKind } from "../mail/return-mail";
import { PrismaService } from "../prisma.service";
import { itemName, restock } from "../products/stock";
import { SiteService } from "../site/site.module";
import { SmsService } from "../sms/sms.service";
import { SettingsService } from "../store/settings.service";
import { DecideReturnDto, RequestReturnDto } from "./order.dto";
import { OrdersService, orderRef } from "./orders.service";
import { canRequestReturn, eligibleQty, lineWindow, maskUpi, nextReturnState, payoutAmount, payoutDue, returnableQty, returnRefund, type RefundOrder } from "./returns";
import { onlineChargePaise, splitRefund } from "./payment";

const OPEN: ReturnStatus[] = ["REQUESTED", "APPROVED"];

@Injectable()
export class ReturnsService {
  private readonly log = new Logger(ReturnsService.name);

  constructor(private prisma: PrismaService, private orders: OrdersService, private settings: SettingsService, private mail: MailService, private site: SiteService, private sms: SmsService) {}

  async request(userId: string, orderId: string, dto: RequestReturnDto) {
    const { returnWindowDays } = await this.settings.get();
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Two requests sent at once must not both claim the same units.
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} AND "userId" = ${userId} FOR UPDATE`;
        const order = await tx.order.findFirst({ where: { id: orderId, userId }, include: { items: { include: { product: { select: { name: true } } } }, returns: { where: { status: { in: OPEN } }, select: { items: { select: { orderItemId: true, quantity: true } } } } } });
        if (!order) throw new NotFoundException();

        const pending = new Map<string, number>();
        for (const r of order.returns) for (const i of r.items) pending.set(i.orderItemId, (pending.get(i.orderItemId) ?? 0) + i.quantity);
        const lines = order.items.map((i) => ({ id: i.id, quantity: i.quantity, returnedQty: i.returnedQty, pendingQty: pending.get(i.id) ?? 0, returnDays: i.returnDays }));
        const names = new Map(order.items.map((i) => [i.id, itemName(i.product.name, i.optionLabel)]));
        const check = canRequestReturn(order, returnWindowDays, lines);
        if (!check.ok) throw new BadRequestException(check.reason);
        // Cash on delivery has no payment method to send money back to, so we need somewhere to pay it. A part-paid order may need it too, for what was paid on delivery.
        const needsUpi = order.paymentMethod === "COD" || order.advancePaise > 0;
        const payoutUpi = needsUpi ? dto.upiId?.trim() : undefined;
        if (needsUpi && !payoutUpi) throw new BadRequestException("Enter the UPI ID we should send your refund to.");

        const picks = dto.items ?? lines.map((l) => ({ orderItemId: l.id, quantity: eligibleQty(order, l, returnWindowDays) })).filter((p) => p.quantity > 0);
        if (picks.length === 0) throw new BadRequestException("Choose at least one item to return.");
        const seen = new Set<string>();
        for (const p of picks) {
          const line = lines.find((l) => l.id === p.orderItemId);
          if (!line) throw new BadRequestException("One of the items is not part of this order.");
          if (seen.has(p.orderItemId)) throw new BadRequestException("Each item can only be listed once.");
          seen.add(p.orderItemId);
          // An item sold as non-returnable stays non-returnable, whatever the store's window is now.
          if (lineWindow(line, returnWindowDays) <= 0) throw new BadRequestException(`${names.get(line.id)} cannot be returned; it was sold as non-returnable.`);
          if (eligibleQty(order, line, returnWindowDays) === 0 && returnableQty(line) > 0) throw new BadRequestException(`The return window for ${names.get(line.id)} has ended.`);
          if (p.quantity > returnableQty(line)) throw new BadRequestException("You can't return more than you have left to return of an item.");
        }
        return tx.returnRequest.create({ data: { orderId, userId, reason: dto.reason, details: dto.details?.trim() || null, payoutUpi: payoutUpi ?? null, items: { create: picks.map((p) => ({ orderItemId: p.orderItemId, quantity: p.quantity })) } }, include: { items: true } });
      });
      void this.notify(created.id, "requested");
      return created;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new BadRequestException("A return has already been requested for this order.");
      throw e;
    }
  }

  async list(status?: ReturnStatus) {
    const rows = await this.prisma.returnRequest.findMany({
      where: status ? { status } : undefined,
      include: {
        user: { select: { name: true, email: true, phone: true } },
        items: { include: { orderItem: { select: { id: true, pricePaise: true, optionLabel: true, product: { select: { name: true } } } } } },
        order: { select: { id: true, status: true, totalPaise: true, discountPaise: true, shippingPaise: true, paymentMethod: true, advancePaise: true, refundedPaise: true, deliveredAt: true, items: { select: { id: true, quantity: true, pricePaise: true, returnedQty: true } }, returns: { where: { status: "REFUNDED" }, select: { refundPaise: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map(({ order, ...r }) => ({
      ...r,
      order: { id: order.id, status: order.status, totalPaise: order.totalPaise, paymentMethod: order.paymentMethod, advancePaise: order.advancePaise, refundedPaise: order.refundedPaise, deliveredAt: order.deliveredAt },
      // What refunding this request would send back, so the admin can see it before confirming.
      payoutDue: payoutDue(r, order.paymentMethod),
      // What goes (or went) to the customer's UPI ID: the whole refund for cash orders, and for part-paid orders what the online payment could not cover.
      payoutTotalPaise: r.payoutPaise ?? (order.paymentMethod === "COD" ? r.refundPaise ?? 0 : 0),
      refundPreviewPaise: r.status === "REFUNDED" ? (r.refundPaise ?? 0) : returnRefund(this.refundOrder(order), Object.fromEntries(r.items.map((i) => [i.orderItemId, i.quantity]))).totalPaise,
    }));
  }

  private refundOrder(o: { items: { id: string; quantity: number; pricePaise: number; returnedQty: number }[]; discountPaise: number; shippingPaise: number; totalPaise: number; returns: { refundPaise: number | null }[] }): RefundOrder {
    return { items: o.items, discountPaise: o.discountPaise, shippingPaise: o.shippingPaise, totalPaise: o.totalPaise, alreadyRefundedPaise: o.returns.reduce((n, r) => n + (r.refundPaise ?? 0), 0) };
  }

  async decide(id: string, dto: DecideReturnDto) {
    const req = await this.prisma.returnRequest.findUnique({ where: { id }, include: { items: true } });
    if (!req) throw new NotFoundException();
    const next = nextReturnState(req.status, dto.action);
    if (!next) throw new ConflictException(`This request cannot be ${({ approve: "approved", reject: "rejected", refund: "refunded", paid: "marked as paid" })[dto.action]} while it is ${req.status.toLowerCase()}.`);
    const note = dto.note?.trim() || null;
    if (dto.action === "reject" && !note) throw new BadRequestException("Tell the customer why the return is being declined.");

    if (dto.action === "refund") return this.refund(req, note);
    if (dto.action === "paid") return this.markPaidOut(req, dto.reference?.trim() || null);

    const updated = await this.prisma.returnRequest.update({ where: { id }, data: { status: next, adminNote: note ?? req.adminNote, resolvedAt: next === "APPROVED" ? null : new Date() } });
    void this.notify(id, dto.action === "approve" ? "approved" : "rejected");
    return updated;
  }

  // Sends the money for these items back, puts them on the shelf again and, when nothing is left to return, closes the order as refunded.
  private async refund(req: { id: string; orderId: string; adminNote: string | null; items: { orderItemId: string; quantity: number }[] }, note: string | null) {
    const order = await this.prisma.order.findUnique({ where: { id: req.orderId }, include: { items: true, returns: { where: { status: "REFUNDED" }, select: { refundPaise: true } } } });
    if (!order) throw new NotFoundException();
    const picks = Object.fromEntries(req.items.map((i) => [i.orderItemId, i.quantity]));
    const { totalPaise, completesOrder } = returnRefund(this.refundOrder(order), picks);

    // Money goes first, so a failed refund leaves the request open. Only what was paid online can go back online; the rest is paid out to the UPI ID.
    const paidOnline = order.paymentMethod === "ONLINE" && !!order.paymentId;
    const { onlinePaise, payoutPaise } = paidOnline ? splitRefund(totalPaise, onlineChargePaise(order) - order.refundedPaise) : { onlinePaise: 0, payoutPaise: totalPaise };
    const online = onlinePaise > 0;
    if (online) await this.orders.refundOnline(order, onlinePaise);

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const i of req.items) {
        const item = order.items.find((x) => x.id === i.orderItemId)!;
        await tx.orderItem.update({ where: { id: item.id }, data: { returnedQty: { increment: i.quantity } } });
        await restock(tx, item, i.quantity, { reason: "RETURNED", orderId: order.id, note: "Returned items refunded" });
      }
      if (completesOrder) await tx.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
      return tx.returnRequest.update({ where: { id: req.id }, data: { status: "REFUNDED", refundPaise: totalPaise, payoutPaise, adminNote: note ?? req.adminNote, resolvedAt: new Date() } });
    });

    if (completesOrder) void this.orders.notify(order.id, "refunded", online);
    else void this.notify(req.id, "refunded", { refundPaise: totalPaise, refundIssued: online });
    return updated;
  }

  // Records that the admin sent a pay-on-delivery refund to the customer's UPI ID.
  private async markPaidOut(req: { id: string; orderId: string; status: string; refundPaise: number | null; payoutPaise: number | null; paidOutAt: Date | null; payoutUpi: string | null }, reference: string | null) {
    const order = await this.prisma.order.findUnique({ where: { id: req.orderId }, select: { paymentMethod: true } });
    if (!order || !payoutDue(req, order.paymentMethod)) throw new ConflictException("There is no refund waiting to be paid out for this request.");
    if (!reference) throw new BadRequestException("Enter the UPI transaction reference so the payout can be traced.");
    // One conditional update, so two admins cannot both record the same payout.
    const { count } = await this.prisma.returnRequest.updateMany({ where: { id: req.id, paidOutAt: null, status: "REFUNDED" }, data: { paidOutAt: new Date(), payoutRef: reference } });
    if (count !== 1) throw new ConflictException("This payout was already recorded.");
    void this.notify(req.id, "paid", { refundPaise: payoutAmount(req, order.paymentMethod) });
    return this.prisma.returnRequest.findUniqueOrThrow({ where: { id: req.id } });
  }

  // Emails never block or fail the request; phone-only accounts have no address to write to.
  private async notify(id: string, kind: ReturnMailKind, extra: { refundPaise?: number; refundIssued?: boolean } = {}) {
    try {
      const r = await this.prisma.returnRequest.findUnique({ where: { id }, include: { user: { select: { name: true, email: true, phone: true } } } });
      if (!r) return;
      const data = { brand: await this.site.brandName(), name: r.user.name, orderRef: orderRef(r.orderId), reason: r.reason, note: r.adminNote, url: `${await this.site.webOrigin()}/orders`, payoutUpi: r.payoutUpi ? maskUpi(r.payoutUpi) : undefined, payoutRef: r.payoutRef ?? undefined, ...extra };
      if (r.user.email) await this.mail.send({ to: r.user.email, ...returnMail(kind, data) });
      // Someone who signed up with a phone number only should still hear that their money was sent.
      else if (kind === "paid" && r.user.phone) await this.sms.send(r.user.phone, `${data.brand}: we've paid ₹${((extra.refundPaise ?? 0) / 100).toLocaleString("en-IN")} to your UPI ID ${data.payoutUpi ?? ""} for order ${data.orderRef}${data.payoutRef ? ` (ref ${data.payoutRef})` : ""}.`);
    } catch (e) {
      this.log.warn(`Could not send the ${kind} return email for ${id}: ${(e as Error).message}`);
    }
  }
}
