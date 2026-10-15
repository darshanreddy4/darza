import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { MailService } from "../mail/mail.service";
import { lowStockMail } from "../mail/inventory-mail";
import { PrismaService } from "../prisma.service";
import { SiteService } from "../site/site.module";
import { SettingsService } from "../store/settings.service";

// Overridable so the end-to-end tests do not have to wait.
const EVERY_MS = Number(process.env.INVENTORY_ALERT_INTERVAL_SECONDS ?? 3600) * 1000;

@Injectable()
export class InventoryAlertsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(InventoryAlertsService.name);
  private timer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService, private mail: MailService, private site: SiteService, private settings: SettingsService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.run().catch((e) => this.log.error(e)), EVERY_MS);
    this.timer.unref();
  }
  onModuleDestroy() { clearInterval(this.timer); }

  // One email lists everything that has newly dropped to the threshold; a product is mentioned again only after its stock has recovered and dropped again.
  async run() {
    const { lowStockThreshold, alertEmail } = await this.settings.get();
    // Products back above the threshold can be alerted about again next time.
    await this.prisma.product.updateMany({ where: { lowStockAlertedAt: { not: null }, stock: { gt: lowStockThreshold } }, data: { lowStockAlertedAt: null } });
    if (!alertEmail) return 0;

    const low = await this.prisma.product.findMany({
      where: { productType: "OWN", status: "PUBLISHED", stock: { lte: lowStockThreshold }, lowStockAlertedAt: null },
      select: { id: true, name: true, sku: true, stock: true },
      orderBy: [{ stock: "asc" }, { name: "asc" }],
      take: 200,
    });
    if (low.length === 0) return 0;

    // Claimed first, so two API instances never send the same digest twice.
    const claimed = await this.prisma.product.updateMany({ where: { id: { in: low.map((p) => p.id) }, lowStockAlertedAt: null }, data: { lowStockAlertedAt: new Date() } });
    if (claimed.count === 0) return 0;
    try {
      await this.mail.send({
        to: alertEmail,
        ...lowStockMail({ brand: await this.site.brandName(), threshold: lowStockThreshold, items: low.map((p) => ({ name: p.name, sku: p.sku, stock: p.stock ?? 0 })), url: `${await this.site.webOrigin()}/admin/attention` }),
      });
    } catch (e) {
      this.log.warn(`Could not send the low-stock email: ${(e as Error).message}`);
    }
    return low.length;
  }
}
