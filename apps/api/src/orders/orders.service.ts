import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { SiteService } from "../site/site.module";
import { MailService } from "../mail/mail.service";
import { orderMail, type OrderMailKind } from "../mail/order-mail";
import { PrismaService } from "../prisma.service";
import { SmsService } from "../sms/sms.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { orderUpdateSentence } from "../whatsapp/whatsapp-message";
import { RazorpayService } from "../payments/razorpay.service";
import { verifyCheckoutSignature } from "../payments/signature";
import { CouponsService } from "../store/coupons.service";
import { offerText } from "../store/coupon-rules";
import { multiBuyOf, priceLine } from "../products/multi-buy";
import { productReturnDays } from "../products/return-policy";
import { sellingPrice } from "../products/sale";
import { chooseOption, lineKey } from "../products/product-options";
import { itemName, restock } from "../products/stock";
import { PincodeService } from "../store/pincode.service";
import { deliveryModeOf, parseGifts, parseZones, priceBasket, rewardDiscountFor, zoneFor } from "../store/delivery";
import { SettingsService } from "../store/settings.service";
import { CreateOrderDto, QuoteDto, VerifyPaymentDto } from "./order.dto";
import { canCustomerCancel, cancelReasonText } from "./cancel";
import { canRequestReturn, eligibleQty, lineWindow, orderReturnDeadline } from "./returns";

// Statuses where stock has been returned to inventory.
const RELEASED: OrderStatus[] = ["CANCELLED", "REFUNDED"];
// Statuses where an online payment has been received.
const PAID_STATES: OrderStatus[] = ["PAID", "SHIPPED", "DELIVERED"];
// Unpaid online orders hold stock only this long.
const PAYMENT_WINDOW_MS = 30 * 60 * 1000;

const orderInclude = {
  items: { include: { product: { select: { name: true, slug: true, images: { orderBy: { position: "asc" }, take: 1 } } } } },
} satisfies Prisma.OrderInclude;

export interface PaymentParams { orderId: string; keyId: string; razorpayOrderId: string; amountPaise: number; currency: "INR" }

export const orderRef = (id: string) => `#${id.slice(-8).toUpperCase()}`;

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(OrdersService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private razorpay: RazorpayService,
    private mail: MailService,
    private settings: SettingsService,
    private coupons: CouponsService,
    private site: SiteService,
    private whatsapp: WhatsAppService,
    private sms: SmsService,
    private pincodes: PincodeService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.expireStale().catch((e) => this.log.error(e)), 5 * 60 * 1000);
    this.timer.unref();
  }
  onModuleDestroy() { clearInterval(this.timer); }

  // The same product in the same size is one line; different sizes of a product are separate lines.
  private mergeLines(items: { productId: string; optionId?: string; quantity: number }[]) {
    const lines = new Map<string, { productId: string; optionId: string | null; quantity: number }>();
    for (const i of items) {
      const key = lineKey(i.productId, i.optionId);
      lines.set(key, { productId: i.productId, optionId: i.optionId ?? null, quantity: Math.min(99, (lines.get(key)?.quantity ?? 0) + i.quantity) });
    }
    return [...lines.values()];
  }

  // Prices a basket for the cart and checkout. A signed-in customer's code limits are checked here too; the delivery phone number only counts when the order is placed.
  async quote(dto: QuoteDto, userId?: string) {
    const settings = await this.settings.get();
    const wanted = this.mergeLines(dto.items);
    const products = await this.prisma.product.findMany({ where: { id: { in: [...new Set(wanted.map((w) => w.productId))] }, status: "PUBLISHED", productType: "OWN" }, select: { id: true, pricePaise: true, productType: true, multiBuyQty: true, multiBuyPercent: true, salePricePaise: true, saleEndsAt: true, returnDays: true, returnPolicy: true, freeDelivery: true, chargeDelivery: true, deliveryFeePaise: true, options: { select: { id: true, pricePaise: true } } } });
    const byId = new Map(products.map((p) => [p.id, p]));
    const unavailable: string[] = [];
    // "Buy N, save extra P%" is already in the unit prices, so the subtotal is what will be charged for the goods.
    const priced = wanted.flatMap((w) => {
      const p = byId.get(w.productId);
      const choice = p ? chooseOption(p.options, w.optionId) : null;
      if (!p || !choice?.ok) { unavailable.push(w.productId); return []; }
      const line = priceLine(choice.option ? choice.option.pricePaise : sellingPrice(p), w.quantity, multiBuyOf(p));
      return [{ p, quantity: w.quantity, line: { productId: p.id, optionId: choice.option?.id ?? null, returnDays: productReturnDays(p, settings.returnWindowDays), ...line } }];
    });
    const lines = priced.map((x) => x.line);
    const subtotal = priced.reduce((sum, x) => sum + x.line.unitPaise * x.quantity, 0);

    let discount = 0;
    let coupon: { code: string; description: string | null } | null = null;
    let couponError: string | null = null;
    const tiers = parseGifts(settings.giftTiers);
    // A percentage reward comes off first and the coupon works on the rest.
    const afterReward = subtotal - (rewardDiscountFor(subtotal, tiers)?.paise ?? 0);
    if (dto.couponCode?.trim()) {
      const found = await this.coupons.evaluate(dto.couponCode, afterReward, userId);
      if (!found) couponError = "This code isn't valid";
      else if (!found.result.ok) couponError = found.result.reason;
      else { discount = found.result.discountPaise; coupon = { code: found.coupon.code, description: found.coupon.description }; }
    }
    const offers = await this.coupons.offers(userId, afterReward);
    const basket = priceBasket({
      lines: priced.map((x) => ({ goodsPaise: x.line.unitPaise * x.quantity, mode: deliveryModeOf(x.p), feePaise: x.p.deliveryFeePaise })),
      discountPaise: discount, rules: settings, zone: zoneFor(parseZones(settings.deliveryZones), dto.pincode), gifts: tiers,
      coupons: offers.filter((o) => o.minOrderPaise > 0).map((o) => ({ title: `${offerText(o)} with code ${o.code}`, atPaise: o.minOrderPaise, reached: o.unlocked })),
    });
    return {
      ...basket, coupon, couponError, offers, unavailable,
      multiBuySavedPaise: lines.reduce((n, l) => n + l.savedPaise, 0), lines,
    };
  }

  async create(userId: string, dto: CreateOrderDto) {
    const online = dto.paymentMethod === "ONLINE";
    if (online && !this.razorpay.enabled) throw new ServiceUnavailableException("Online payments are not available right now. Please choose pay on delivery.");

    const settings = await this.settings.get();
    const brand = await this.site.brandName();
    await this.pincodes.assertValid(dto.shipping.pincode);
    const wanted = this.mergeLines(dto.items);
    const productIds = [...new Set(wanted.map((w) => w.productId))];

    const order = await this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { id: { in: productIds } }, include: { options: true } });
      if (products.length !== productIds.length) throw new BadRequestException("Some products no longer exist");
      const byId = new Map(products.map((p) => [p.id, p]));

      let subtotal = 0;
      const bought: { p: (typeof products)[number]; option: (typeof products)[number]["options"][number] | null; quantity: number; unitPaise: number }[] = [];
      for (const w of wanted) {
        const p = byId.get(w.productId)!;
        if (p.productType !== "OWN" || p.status !== "PUBLISHED") throw new BadRequestException(`${p.name} cannot be purchased on ${brand}`);
        const choice = chooseOption(p.options, w.optionId);
        if (!choice.ok) throw new BadRequestException(choice.reason === "CHOOSE" ? `Choose a size for ${p.name}` : `That size of ${p.name} is no longer available`);
        const option = choice.option;
        const q = w.quantity;
        const name = itemName(p.name, option?.label);
        // Conditional decrement keeps stock from going negative under concurrent orders.
        if (option) {
          const res = await tx.productOption.updateMany({ where: { id: option.id, stock: { gte: q } }, data: { stock: { decrement: q } } });
          if (res.count === 0) throw new ConflictException(`Not enough stock for ${name}`);
          await tx.product.update({ where: { id: p.id }, data: { stock: { decrement: q } } });
        } else {
          const res = await tx.product.updateMany({ where: { id: p.id, stock: { gte: q } }, data: { stock: { decrement: q } } });
          if (res.count === 0) throw new ConflictException(`Not enough stock for ${name}`);
        }
        const line = priceLine(option ? option.pricePaise : sellingPrice(p), q, multiBuyOf(p));
        bought.push({ p, option, quantity: q, unitPaise: line.unitPaise });
        subtotal += line.unitPaise * q;
      }

      let discountPaise = 0;
      let couponId: string | null = null;
      let couponCode: string | null = null;
      const tiers = parseGifts(settings.giftTiers);
      const rewardPaise = Math.min(rewardDiscountFor(subtotal, tiers)?.paise ?? 0, subtotal);
      // The same person is recognised by account, email and phone, also on a second account.
      const who = await this.coupons.identity(userId, dto.shipping.phone, tx);
      if (dto.couponCode?.trim()) {
        const found = await this.coupons.evaluate(dto.couponCode, subtotal - rewardPaise, userId, tx, { shipPhone: dto.shipping.phone, lock: true });
        if (!found) throw new BadRequestException("This coupon code isn't valid");
        if (!found.result.ok) throw new BadRequestException(found.result.reason);
        discountPaise = found.result.discountPaise;
        couponId = found.coupon.id;
        couponCode = found.coupon.code;
      }
      const basket = priceBasket({
        lines: bought.map((b) => ({ goodsPaise: b.unitPaise * b.quantity, mode: deliveryModeOf(b.p), feePaise: b.p.deliveryFeePaise })),
        discountPaise, rules: settings, zone: zoneFor(parseZones(settings.deliveryZones), dto.shipping.pincode), gifts: tiers,
      });
      const shippingPaise = basket.shippingPaise;
      const totalDiscount = discountPaise + basket.rewardDiscountPaise;

      return tx.order.create({
        data: {
          userId,
          status: online ? "PENDING_PAYMENT" : "PLACED",
          paymentMethod: online ? "ONLINE" : "COD",
          subtotalPaise: subtotal, discountPaise: totalDiscount, rewardDiscountPaise: basket.rewardDiscountPaise, shippingPaise, totalPaise: subtotal - totalDiscount + shippingPaise, gifts: basket.earnedGifts,
          couponId, couponCode, gstApplied: settings.gstEnabled,
          buyerEmailKey: who?.emailKey ?? null, buyerPhoneKey: who?.phoneKey ?? null, shipPhoneKey: who?.shipPhoneKey ?? null,
          whatsappOptIn: !!dto.whatsappUpdates && this.whatsapp.available,
          shippingName: dto.shipping.name,
          shippingAddr: dto.shipping as unknown as Prisma.InputJsonValue,
          items: {
            create: bought.map((b) => ({
              productId: b.p.id, quantity: b.quantity, pricePaise: b.unitPaise, costPaise: b.option ? b.option.costPaise : b.p.costPaise, gstRatePercent: b.p.gstRatePercent,
              returnDays: productReturnDays(b.p, settings.returnWindowDays), optionId: b.option?.id ?? null, optionLabel: b.option?.label ?? null,
            })),
          },
        },
        include: orderInclude,
      });
    });

    // Whatever was in the cart has just been bought.
    void this.prisma.cartSnapshot.deleteMany({ where: { userId } }).catch(() => undefined);

    if (!online) {
      void this.notify(order.id, "placed");
      return { order, payment: null };
    }
    try {
      return { order, payment: await this.attachRazorpayOrder(order.id, order.totalPaise) };
    } catch (e) {
      await this.cancelPending(order.id);
      throw e;
    }
  }

  // Creates (or reuses) the Razorpay order for an unpaid online order.
  async startPayment(userId: string, orderId: string): Promise<PaymentParams> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException();
    if (order.paymentMethod !== "ONLINE" || order.status !== "PENDING_PAYMENT") throw new BadRequestException("This order does not need payment");
    if (!this.razorpay.enabled) throw new ServiceUnavailableException("Online payments are not available right now.");
    if (order.paymentRef) return this.params(order.id, order.paymentRef, order.totalPaise);
    return this.attachRazorpayOrder(order.id, order.totalPaise);
  }

  async verify(userId: string, orderId: string, dto: VerifyPaymentDto) {
    if (!this.razorpay.enabled) throw new ServiceUnavailableException("Online payments are not available right now.");
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order || !order.paymentRef || order.paymentRef !== dto.razorpay_order_id) throw new NotFoundException();
    if (!verifyCheckoutSignature(dto.razorpay_order_id, dto.razorpay_payment_id, dto.razorpay_signature, this.razorpay.keySecret)) {
      throw new BadRequestException("Payment verification failed");
    }
    await this.markPaid(dto.razorpay_order_id, dto.razorpay_payment_id);
    return { ok: true };
  }

  // Idempotent: both the checkout callback and the webhook can report the same payment.
  async markPaid(razorpayOrderId: string, paymentId: string) {
    const res = await this.prisma.order.updateMany({
      where: { paymentRef: razorpayOrderId, status: "PENDING_PAYMENT" },
      data: { status: "PAID", paymentId },
    });
    if (res.count > 0) {
      const paid = await this.prisma.order.findFirst({ where: { paymentRef: razorpayOrderId }, select: { id: true } });
      if (paid) void this.notify(paid.id, "paid");
      return;
    }
    const late = await this.prisma.order.findFirst({ where: { paymentRef: razorpayOrderId, status: "CANCELLED" } });
    if (late) {
      await this.prisma.order.update({ where: { id: late.id }, data: { paymentId } });
      await this.refundLatePayment(late.id, paymentId, late.totalPaise);
    }
  }

  // The order expired before the customer's payment arrived, so the money goes straight back.
  private async refundLatePayment(orderId: string, paymentId: string, totalPaise: number) {
    if (!this.razorpay.enabled) return this.log.warn(`Payment ${paymentId} captured for cancelled order ${orderId}; refund it in the Razorpay dashboard.`);
    try {
      const refund = await this.razorpay.refund(paymentId, totalPaise, orderId);
      await this.prisma.order.update({ where: { id: orderId }, data: { refundId: refund.id, refundedPaise: refund.amount } });
      void this.notify(orderId, "refunded", true);
    } catch (e) {
      this.log.warn(`Payment ${paymentId} captured for cancelled order ${orderId} and the automatic refund failed (${(e as Error).message}); refund it in the Razorpay dashboard.`);
    }
  }

  async mine(userId: string) {
    const [orders, { returnWindowDays }] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        include: {
          ...orderInclude,
          returns: { select: { id: true, status: true, reason: true, details: true, adminNote: true, createdAt: true, refundPaise: true, payoutUpi: true, paidOutAt: true, items: { select: { orderItemId: true, quantity: true } } }, orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.settings.get(),
    ]);
    return orders.map((o) => {
      // Units sitting in a request that is still open are not available for another one.
      const pending = new Map<string, number>();
      for (const r of o.returns) if (r.status === "REQUESTED" || r.status === "APPROVED") for (const i of r.items) pending.set(i.orderItemId, (pending.get(i.orderItemId) ?? 0) + i.quantity);
      const lines = o.items.map((i) => ({ quantity: i.quantity, returnedQty: i.returnedQty, pendingQty: pending.get(i.id) ?? 0, returnDays: i.returnDays }));
      // returnWindowDays is the window each item was sold with; 0 marks one that cannot be returned.
      const items = o.items.map((i, n) => ({ ...i, returnWindowDays: lineWindow(lines[n], returnWindowDays), returnableQty: eligibleQty(o, lines[n], returnWindowDays) }));
      const ok = canRequestReturn(o, returnWindowDays, lines).ok;
      return { ...o, items, returnableUntil: ok ? orderReturnDeadline(o, lines, returnWindowDays) : null };
    });
  }

  listAdmin(status?: OrderStatus) {
    return this.prisma.order.findMany({
      where: status ? { status } : undefined,
      include: { ...orderInclude, user: { select: { name: true, email: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async updateStatus(id: string, status: OrderStatus) {
    const current = await this.prisma.order.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    if (current.status === status) return this.prisma.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
    if (RELEASED.includes(current.status)) throw new BadRequestException("Cancelled or refunded orders cannot be changed");

    // Money goes back before anything else changes, so a failed refund leaves the order as it was.
    const refundIssued = RELEASED.includes(status) ? await this.refundIfPaid(current) : false;

    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!order) throw new NotFoundException();
      if (RELEASED.includes(status)) {
        // Units that came back through a return were restocked then.
        for (const i of order.items) await restock(tx, i, i.quantity - i.returnedQty);
      }
      return tx.order.update({ where: { id }, data: { status, ...(status === "DELIVERED" && { deliveredAt: new Date() }) }, include: orderInclude });
    });
    // A refund settles any return still open for this order.
    if (status === "REFUNDED") await this.prisma.returnRequest.updateMany({ where: { orderId: id, status: { in: ["REQUESTED", "APPROVED"] } }, data: { status: "REFUNDED", resolvedAt: new Date() } });

    const kind = ({ SHIPPED: "shipped", DELIVERED: "delivered", CANCELLED: "cancelled", REFUNDED: "refunded" } as Partial<Record<OrderStatus, OrderMailKind>>)[status];
    if (kind) void this.notify(id, kind, refundIssued);
    return updated;
  }

  // Refunds the full amount of a paid online order through Razorpay; returns whether money was (or already had been) sent back.
  private async refundIfPaid(order: { id: string; paymentMethod: string; paymentId: string | null; status: OrderStatus; totalPaise: number; refundedPaise: number }) {
    if (order.paymentMethod !== "ONLINE" || !order.paymentId || !PAID_STATES.includes(order.status)) return false;
    // Whatever earlier part-returns already sent back is not sent twice.
    const remaining = order.totalPaise - order.refundedPaise;
    if (remaining <= 0) return true;
    await this.refundOnline(order, remaining);
    return true;
  }

  // Sends money back through Razorpay and records it straight away, so a retry after a later failure doesn't refund twice.
  async refundOnline(order: { id: string; paymentId: string | null; refundedPaise: number }, amountPaise: number) {
    if (!order.paymentId) return null;
    if (!this.razorpay.enabled) throw new ServiceUnavailableException("Razorpay isn't configured, so this payment can't be refunded automatically. Refund it in the Razorpay dashboard first.");
    const refund = await this.razorpay.refund(order.paymentId, amountPaise, order.id);
    await this.prisma.order.update({ where: { id: order.id }, data: { refundId: refund.id, refundedPaise: { increment: refund.amount } } });
    return refund;
  }

  // The customer cancels their own order before it ships. The order is claimed first so two clicks (or an admin shipping it at
  // the same moment) cannot both win; money is sent back before stock is, and the claim is undone if the refund fails.
  async cancelByCustomer(userId: string, orderId: string, reason: string, details?: string) {
    const current = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!current) throw new NotFoundException();
    const check = canCustomerCancel(current.status);
    if (!check.ok) throw new ConflictException(check.reason);

    const cancelReason = cancelReasonText(reason, details);
    const claimed = await this.prisma.order.updateMany({ where: { id: orderId, userId, status: current.status }, data: { status: "CANCELLED", cancelReason } });
    if (claimed.count !== 1) throw new ConflictException("This order just changed and can no longer be cancelled. Please refresh.");

    let refundIssued = false;
    try {
      refundIssued = await this.refundIfPaid(current);
    } catch (e) {
      await this.prisma.order.updateMany({ where: { id: orderId, status: "CANCELLED" }, data: { status: current.status, cancelReason: null } });
      throw e;
    }
    await this.prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const i of items) await restock(tx, i, i.quantity - i.returnedQty);
    });
    void this.notify(orderId, "cancelled", refundIssued);
    return this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  }

  // Cancels an unpaid online order and returns its stock; no-op if it was paid in the meantime.
  async cancelPending(orderId: string) {
    await this.prisma.$transaction(async (tx) => {
      const res = await tx.order.updateMany({ where: { id: orderId, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
      if (res.count === 0) return;
      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const i of items) await restock(tx, i, i.quantity);
    });
  }

  async expireStale() {
    const stale = await this.prisma.order.findMany({
      where: { status: "PENDING_PAYMENT", paymentMethod: "ONLINE", createdAt: { lt: new Date(Date.now() - PAYMENT_WINDOW_MS) } },
      select: { id: true },
    });
    for (const o of stale) await this.cancelPending(o.id);
    if (stale.length) this.log.log(`Released stock for ${stale.length} unpaid order(s)`);
  }

  // Emails never block or fail an order; MailService logs its own errors.
  async notify(orderId: string, kind: OrderMailKind, refundIssued = false) {
    try {
      const o = await this.prisma.order.findUnique({ where: { id: orderId }, include: { user: { select: { name: true, email: true, phone: true } }, items: { include: { product: { select: { name: true } } } } } });
      if (!o) return;
      const url = `${await this.site.webOrigin()}/orders`;
      // Phone-only accounts have no email address to write to.
      if (o.user.email) {
        await this.mail.send({
          to: o.user.email,
          ...orderMail(kind, {
            brand: await this.site.brandName(), name: o.user.name, orderRef: orderRef(o.id), items: o.items.map((i) => ({ name: itemName(i.product.name, i.optionLabel), quantity: i.quantity, pricePaise: i.pricePaise })),
            subtotalPaise: o.subtotalPaise || o.totalPaise, discountPaise: o.discountPaise, shippingPaise: o.shippingPaise, totalPaise: o.totalPaise,
            couponCode: o.couponCode, paymentMethod: o.paymentMethod, refundIssued, url,
          }),
        });
      }
      if (o.whatsappOptIn) {
        const phone = (o.shippingAddr as { phone?: string } | null)?.phone;
        if (phone) await this.whatsapp.sendOrderUpdate(phone, kind, { name: o.user.name, orderRef: orderRef(o.id), totalPaise: o.totalPaise, refundIssued, url });
      }
      // An account with only a phone number would otherwise hear nothing unless it ticked WhatsApp at checkout.
      if (!o.user.email && !o.whatsappOptIn && o.user.phone) {
        await this.sms.send(o.user.phone, `${await this.site.brandName()}: Hi ${o.user.name}, ${orderUpdateSentence(kind, { totalPaise: o.totalPaise, refundIssued })} Order ${orderRef(o.id)}. ${url}`);
      }
    } catch (e) {
      this.log.warn(`Could not send the ${kind} message for order ${orderId}: ${(e as Error).message}`);
    }
  }

  private async attachRazorpayOrder(orderId: string, amountPaise: number): Promise<PaymentParams> {
    const rzp = await this.razorpay.createOrder(amountPaise, orderId);
    await this.prisma.order.update({ where: { id: orderId }, data: { paymentRef: rzp.id } });
    return this.params(orderId, rzp.id, amountPaise);
  }

  private params(orderId: string, razorpayOrderId: string, amountPaise: number): PaymentParams {
    return { orderId, keyId: this.razorpay.keyId, razorpayOrderId, amountPaise, currency: "INR" };
  }
}
