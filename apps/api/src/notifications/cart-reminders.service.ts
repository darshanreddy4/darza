import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { MailService } from "../mail/mail.service";
import { cartReminderMail } from "../mail/cart-mail";
import { PrismaService } from "../prisma.service";
import { chooseOption } from "../products/product-options";
import { itemName } from "../products/stock";
import { SiteService } from "../site/site.module";
import { unsubscribeToken } from "./unsubscribe";

const MINUTE = 60_000;
// Overridable so the end-to-end tests do not have to wait an hour.
const AFTER_MS = Number(process.env.CART_REMINDER_AFTER_MINUTES ?? 60) * MINUTE;
const EVERY_MS = Number(process.env.CART_REMINDER_INTERVAL_SECONDS ?? 900) * 1000;
// Carts older than this are not worth a nudge.
const MAX_AGE_MS = 7 * 24 * 60 * MINUTE;

export type CartItems = { productId: string; optionId?: string; quantity: number }[];

@Injectable()
export class CartRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(CartRemindersService.name);
  private timer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService, private mail: MailService, private site: SiteService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.run().catch((e) => this.log.error(e)), EVERY_MS);
    this.timer.unref();
  }
  onModuleDestroy() { clearInterval(this.timer); }

  // An empty cart removes the snapshot; anything else restarts the countdown.
  async save(userId: string, items: CartItems) {
    if (items.length === 0) return this.clear(userId);
    const data = { items: items as unknown as Prisma.InputJsonValue, savedAt: new Date(), remindedAt: null };
    await this.prisma.cartSnapshot.upsert({ where: { userId }, update: data, create: { userId, ...data } });
  }

  async clear(userId: string) {
    await this.prisma.cartSnapshot.deleteMany({ where: { userId } });
  }

  async run(now = new Date()) {
    const due = await this.prisma.cartSnapshot.findMany({
      where: {
        remindedAt: null,
        savedAt: { lte: new Date(now.getTime() - AFTER_MS), gt: new Date(now.getTime() - MAX_AGE_MS) },
        user: { cartRemindersOff: false, email: { not: null }, emailVerifiedAt: { not: null } },
      },
      include: { user: { select: { name: true, email: true } } },
      take: 100,
    });
    for (const s of due) await this.remind(s, now);
    return due.length;
  }

  private async remind(s: { userId: string; savedAt: Date; items: Prisma.JsonValue; user: { name: string; email: string | null } }, now: Date) {
    // Claimed first, so two API instances never email the same cart twice.
    const claimed = await this.prisma.cartSnapshot.updateMany({ where: { userId: s.userId, remindedAt: null, savedAt: s.savedAt }, data: { remindedAt: now } });
    if (claimed.count === 0) return;

    try {
      if ((await this.prisma.order.count({ where: { userId: s.userId, createdAt: { gt: s.savedAt } } })) > 0) return this.clear(s.userId);
      const items = s.items as CartItems;
      const products = await this.prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) }, status: "PUBLISHED", productType: "OWN", stock: { gt: 0 } }, select: { id: true, name: true, pricePaise: true, options: { select: { id: true, label: true, pricePaise: true, stock: true } } } });
      const byId = new Map(products.map((p) => [p.id, p]));
      // Sold-out or removed sizes are left out.
      const rows = items.flatMap((i) => {
        const p = byId.get(i.productId);
        const choice = p ? chooseOption(p.options, i.optionId) : null;
        if (!p || !choice?.ok || (choice.option && choice.option.stock <= 0)) return [];
        return [{ name: itemName(p.name, choice.option?.label), quantity: i.quantity, pricePaise: choice.option?.pricePaise ?? p.pricePaise }];
      });
      if (rows.length === 0 || !s.user.email) return;

      await this.mail.send({
        to: s.user.email,
        ...cartReminderMail({
          brand: await this.site.brandName(), name: s.user.name,
          items: rows,
          cartUrl: `${await this.site.webOrigin()}/cart`,
          unsubscribeUrl: `${await this.site.webOrigin()}/unsubscribe?token=${unsubscribeToken(s.userId)}`,
        }),
      });
    } catch (e) {
      this.log.warn(`Could not send the cart reminder for user ${s.userId}: ${(e as Error).message}`);
    }
  }

  // Carts that have been sitting long enough to count as abandoned, for the admin overview.
  async abandoned() {
    const rows = await this.prisma.cartSnapshot.findMany({
      where: { savedAt: { lte: new Date(Date.now() - AFTER_MS) } },
      include: { user: { select: { name: true, email: true, phone: true } } },
      orderBy: { savedAt: "desc" },
      take: 100,
    });
    const ids = [...new Set(rows.flatMap((r) => (r.items as CartItems).map((i) => i.productId)))];
    const prices = new Map((await this.prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, pricePaise: true, options: { select: { id: true, pricePaise: true } } } })).map((p) => [p.id, p]));
    const unit = (i: CartItems[number]) => { const p = prices.get(i.productId); return (i.optionId && p?.options.find((o) => o.id === i.optionId)?.pricePaise) || p?.pricePaise || 0; };
    return rows.map((r) => {
      const items = r.items as CartItems;
      return {
        userId: r.userId, name: r.user.name, email: r.user.email, phone: r.user.phone,
        itemCount: items.reduce((n, i) => n + i.quantity, 0),
        valuePaise: items.reduce((n, i) => n + unit(i) * i.quantity, 0),
        savedAt: r.savedAt, remindedAt: r.remindedAt,
      };
    });
  }
}
