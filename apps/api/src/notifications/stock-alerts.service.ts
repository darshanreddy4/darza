import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { MailService } from "../mail/mail.service";
import { backInStockMail } from "../mail/stock-mail";
import { PrismaService } from "../prisma.service";
import { SiteService } from "../site/site.module";

// Overridable so the end-to-end tests do not have to wait.
const EVERY_MS = Number(process.env.STOCK_ALERT_INTERVAL_SECONDS ?? 300) * 1000;

@Injectable()
export class StockAlertsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(StockAlertsService.name);
  private timer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService, private mail: MailService, private site: SiteService) {}

  // Checked on a timer rather than hooked into every place stock changes (edits, bulk edits, cancelled orders, returns).
  onModuleInit() {
    this.timer = setInterval(() => this.run().catch((e) => this.log.error(e)), EVERY_MS);
    this.timer.unref();
  }
  onModuleDestroy() { clearInterval(this.timer); }

  private async soldOutProduct(slug: string) {
    const product = await this.prisma.product.findFirst({ where: { slug, status: "PUBLISHED", productType: "OWN" }, select: { id: true, stock: true } });
    if (!product) throw new NotFoundException();
    return product;
  }

  async status(userId: string, slug: string) {
    const product = await this.soldOutProduct(slug);
    const [alert, user] = await Promise.all([
      this.prisma.stockAlert.findUnique({ where: { userId_productId: { userId, productId: product.id } } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } }),
    ]);
    return { subscribed: !!alert && !alert.notifiedAt, emailReady: !!user.email && !!user.emailVerifiedAt };
  }

  async subscribe(userId: string, slug: string) {
    const product = await this.soldOutProduct(slug);
    if ((product.stock ?? 0) > 0) throw new BadRequestException("This product is in stock now.");
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
    if (!user.email) throw new BadRequestException("Back-in-stock alerts are sent by email, and your account has no email address.");
    if (!user.emailVerifiedAt) throw new BadRequestException("Please verify your email address first, then ask again.");
    const key = { userId, productId: product.id };
    await this.prisma.stockAlert.upsert({ where: { userId_productId: key }, update: { notifiedAt: null }, create: key });
  }

  async unsubscribe(userId: string, slug: string) {
    const product = await this.soldOutProduct(slug);
    await this.prisma.stockAlert.deleteMany({ where: { userId, productId: product.id } });
  }

  // Demand per sold-out product, for the admin.
  async waiting() {
    const rows = await this.prisma.stockAlert.groupBy({ by: ["productId"], where: { notifiedAt: null }, _count: { _all: true } });
    return rows.map((r) => ({ productId: r.productId, waiting: r._count._all }));
  }

  async run() {
    const due = await this.prisma.stockAlert.findMany({
      where: {
        notifiedAt: null,
        product: { status: "PUBLISHED", productType: "OWN", stock: { gt: 0 } },
        user: { email: { not: null }, emailVerifiedAt: { not: null } },
      },
      include: { user: { select: { name: true, email: true } }, product: { select: { name: true, slug: true, pricePaise: true } } },
      take: 200,
    });
    for (const a of due) {
      // Claimed first, so two API instances never send the same alert twice.
      const claimed = await this.prisma.stockAlert.updateMany({ where: { userId: a.userId, productId: a.productId, notifiedAt: null }, data: { notifiedAt: new Date() } });
      if (claimed.count === 0 || !a.user.email) continue;
      try {
        await this.mail.send({ to: a.user.email, ...backInStockMail({ brand: await this.site.brandName(), name: a.user.name, product: a.product.name, pricePaise: a.product.pricePaise, url: `${await this.site.webOrigin()}/products/${a.product.slug}` }) });
      } catch (e) {
        this.log.warn(`Could not send the back-in-stock email for ${a.product.slug}: ${(e as Error).message}`);
      }
    }
    return due.length;
  }
}
