import type { PrismaService } from "../prisma.service";
import type { ReportOrder } from "./sales-report";

// Every order placed in [start, end) with what the sales report needs, plus the store settings for GST.
export async function loadReportData(prisma: PrismaService, start: Date, end: Date) {
  const [orders, settings] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start, lt: end } },
      include: { user: { select: { name: true, email: true, phone: true } }, items: { select: { quantity: true, pricePaise: true, gstRatePercent: true } } },
      orderBy: { createdAt: "asc" },
      take: 50_000,
    }),
    prisma.storeSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } }),
  ]);
  return { orders: orders as unknown as ReportOrder[], settings };
}
