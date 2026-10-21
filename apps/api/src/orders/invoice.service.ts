import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { JwtPayload } from "../auth/auth.guard";
import { PrismaService } from "../prisma.service";
import { itemName } from "../products/stock";
import { buildInvoice, formatInvoiceNumber } from "../store/invoice";
import { SiteService } from "../site/site.module";
import { SettingsService } from "../store/settings.service";
import { orderRef } from "./orders.service";

interface ShippingAddr { name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string }

const same = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

@Injectable()
export class InvoiceService {
  constructor(private prisma: PrismaService, private settings: SettingsService, private site: SiteService) {}

  async get(orderId: string, user: JwtPayload) {
    const load = () => this.prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { product: { select: { name: true } } } } } });
    let order = await load();
    if (!order || (order.userId !== user.sub && !user.permissions?.includes("orders.view"))) throw new NotFoundException();
    if (order.status === "PENDING_PAYMENT" || order.status === "CANCELLED") throw new BadRequestException("An invoice is available once the order is confirmed");

    const settings = await this.settings.get();
    if (!order.invoiceNumber) {
      try {
        await this.assignNumber(orderId);
      } catch (e) {
        // Another request numbered it first; use theirs.
        if (!(e instanceof ConflictException)) throw e;
      }
      order = (await load())!;
    }

    const ship = order.shippingAddr as unknown as ShippingAddr;
    const intraState = order.gstApplied && same(settings.businessState, ship.state);
    const { lines, totals } = buildInvoice({
      items: order.items.map((i) => ({ name: itemName(i.product.name, i.optionLabel), quantity: i.quantity, unitPaise: i.pricePaise, gstRatePercent: i.gstRatePercent, hsnCode: i.hsnCode })),
      discountPaise: order.discountPaise, shippingPaise: order.shippingPaise, shippingLabel: order.codFeePaise > 0 ? "Delivery and cash-on-delivery charge" : undefined, shippingGstPercent: settings.shippingGstPercent,
      gstApplied: order.gstApplied, intraState,
    });

    return {
      number: order.invoiceNumber, issuedAt: order.invoicedAt, type: order.gstApplied ? ("TAX_INVOICE" as const) : ("BILL_OF_SUPPLY" as const),
      orderRef: orderRef(order.id), orderDate: order.createdAt, paymentMethod: order.paymentMethod, advancePaise: order.advancePaise, couponCode: order.couponCode,
      seller: { name: settings.legalName || (await this.site.brandName()), address: settings.businessAddress, state: settings.businessState, gstin: order.gstApplied ? settings.gstin : null },
      buyer: { name: ship.name, phone: ship.phone, address: [ship.line1, ship.line2, `${ship.city} - ${ship.pincode}`].filter(Boolean), state: ship.state },
      intraState, lines, totals,
    };
  }

  // Serial numbers come from one counter, so they never repeat or skip even with concurrent requests.
  private assignNumber(orderId: string) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.storeSettings.update({ where: { id: "default" }, data: { nextInvoiceNo: { increment: 1 } } });
      const number = formatInvoiceNumber(s.invoicePrefix, now, s.nextInvoiceNo - 1);
      const res = await tx.order.updateMany({ where: { id: orderId, invoiceNumber: null }, data: { invoiceNumber: number, invoicedAt: now } });
      if (res.count === 0) throw new ConflictException("Invoice already numbered");
    });
  }
}
