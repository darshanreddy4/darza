import { BadRequestException, Controller, HttpCode, Injectable, Logger, OnModuleDestroy, OnModuleInit, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, Roles } from "../auth/auth.guard";
import { loadReportData } from "../analytics/report-data";
import { lastPeriod, reportDue, type ReportPeriod, type ReportSchedule } from "../analytics/report-period";
import { salesReportCsv, summariseOrders } from "../analytics/sales-report";
import { MailService } from "../mail/mail.service";
import { salesReportMail } from "../mail/report-mail";
import { PrismaService } from "../prisma.service";
import { SiteService } from "../site/site.module";

// Overridable so the end-to-end tests do not have to wait.
const EVERY_MS = Number(process.env.SALES_REPORT_INTERVAL_SECONDS ?? 3600) * 1000;

const ymd = (d: Date) => new Date(d.getTime() + 19_800_000).toISOString().slice(0, 10);

@Injectable()
export class SalesReportService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SalesReportService.name);
  private timer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService, private mail: MailService, private site: SiteService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.run().catch((e) => this.log.error(e)), EVERY_MS);
    this.timer.unref();
  }
  onModuleDestroy() { clearInterval(this.timer); }

  // Sends the report when a new week or month has begun since the last one.
  async run(now = new Date()) {
    const s = await this.prisma.storeSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
    const period = reportDue(s.reportSchedule as ReportSchedule, now, s.reportLastSentAt);
    if (!period || !s.reportEmail) return false;
    // Claimed first, so two API instances never send the same report twice.
    const claimed = await this.prisma.storeSettings.updateMany({ where: { id: "default", OR: [{ reportLastSentAt: null }, { reportLastSentAt: s.reportLastSentAt ?? undefined }] }, data: { reportLastSentAt: now } });
    if (claimed.count === 0) return false;
    return (await this.deliver(s.reportEmail, period)).sent;
  }

  // The most recent finished period for the saved schedule, sent straight away (for checking the setup).
  async sendNow(now = new Date()) {
    const s = await this.prisma.storeSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
    if (s.reportSchedule === "OFF") throw new BadRequestException("Choose weekly or monthly and save first.");
    if (!s.reportEmail) throw new BadRequestException("Add an email address and save first.");
    return this.deliver(s.reportEmail, lastPeriod(s.reportSchedule as "WEEKLY" | "MONTHLY", now));
  }

  private async deliver(to: string, period: ReportPeriod) {
    const { orders, settings } = await loadReportData(this.prisma, period.start, period.end);
    const summary = summariseOrders(orders);
    const filename = `sales-report-${ymd(period.start)}_${ymd(new Date(period.end.getTime() - 1))}.csv`;
    const sent = await this.mail.send({
      to,
      ...salesReportMail({ brand: await this.site.brandName(), label: period.label, summary, url: `${await this.site.webOrigin()}/admin/analytics`, filename }),
      attachments: [{ filename, contentType: "text/csv; charset=utf-8", content: `\uFEFF${salesReportCsv(orders, settings)}` }],
    });
    return { sent, label: period.label, orders: summary.orders, to };
  }
}

@Controller("admin/sales-report")
@UseGuards(AuthGuard)
@Roles("ADMIN")
export class SalesReportController {
  constructor(private reports: SalesReportService) {}

  @Post("send")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  send() {
    return this.reports.sendNow();
  }
}
