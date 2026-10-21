import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { Prisma } from "@prisma/client";
import { AuthGuard, Permit } from "../auth/auth.guard";
import { PrismaService } from "../prisma.service";
import { BUCKET_FORMAT, dateRange, netFigures, parseGranularity } from "./analytics-utils";
import { loadReportData } from "./report-data";
import { salesReportCsv } from "./sales-report";

const TZ = "Asia/Kolkata";
// Timestamps are stored as UTC without a zone, so they are labelled UTC first and then moved to India time.
const istTime = Prisma.sql`(o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}`;
// Orders that count as sales: anything placed and not cancelled/refunded.
const SOLD_EXCLUDED = Prisma.sql`('PENDING_PAYMENT','CANCELLED','REFUNDED')`;
// Orders still waiting to reach the customer.
const UNDELIVERED = Prisma.sql`('PLACED','PAID','SHIPPED')`;

// An order's discount is spread over its items in proportion to their value.
const itemRevenue = Prisma.sql`ROUND(oi.quantity * oi."pricePaise" * (1 - CASE WHEN o."subtotalPaise" > 0 THEN o."discountPaise"::numeric / o."subtotalPaise" ELSE 0 END))`;

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

@Controller("admin/analytics")
@UseGuards(AuthGuard)
@Permit("analytics.view")
export class AnalyticsController {
  constructor(private prisma: PrismaService) {}

  @Get("sales")
  async sales(@Query("granularity") granularity?: string, @Query("from") from?: string, @Query("to") to?: string) {
    const { start, end } = dateRange(from, to);
    const g = parseGranularity(granularity, start, end);
    const unit = Prisma.raw(`'${g}'`);
    const fmt = Prisma.raw(`'${BUCKET_FORMAT[g]}'`);

    const rows = await this.prisma.$queryRaw<{ period: string; orders: number; units: number; gross: bigint; margin: bigint; discount: bigint; shipping: bigint }[]>`
      WITH o AS (
        SELECT id, "createdAt", "discountPaise", "shippingPaise" FROM "Order"
        WHERE status::text NOT IN ${SOLD_EXCLUDED} AND "createdAt" >= ${start} AND "createdAt" < ${end}
      ), i AS (
        SELECT oi."orderId", SUM(oi.quantity) AS units, SUM(oi.quantity * oi."pricePaise") AS gross,
               SUM(oi.quantity * (oi."pricePaise" - COALESCE(oi."costPaise", oi."pricePaise"))) AS margin
        FROM "OrderItem" oi WHERE oi."orderId" IN (SELECT id FROM o) GROUP BY oi."orderId"
      )
      SELECT to_char(date_trunc(${unit}, ${istTime}), ${fmt}) AS period,
             COUNT(*)::int AS orders, COALESCE(SUM(i.units), 0)::int AS units,
             COALESCE(SUM(i.gross), 0)::bigint AS gross, COALESCE(SUM(i.margin), 0)::bigint AS margin,
             COALESCE(SUM(o."discountPaise"), 0)::bigint AS discount, COALESCE(SUM(o."shippingPaise"), 0)::bigint AS shipping
      FROM o LEFT JOIN i ON i."orderId" = o.id GROUP BY 1 ORDER BY 1`;

    const series = rows.map((r) => ({
      period: r.period, orders: r.orders, units: r.units, discountPaise: n(r.discount), shippingPaise: n(r.shipping),
      ...netFigures(n(r.gross), n(r.margin), n(r.discount)),
    }));
    const totals = series.reduce(
      (t, r) => ({
        orders: t.orders + r.orders, units: t.units + r.units, revenuePaise: t.revenuePaise + r.revenuePaise, profitPaise: t.profitPaise + r.profitPaise,
        discountPaise: t.discountPaise + r.discountPaise, shippingPaise: t.shippingPaise + r.shippingPaise,
      }),
      { orders: 0, units: 0, revenuePaise: 0, profitPaise: 0, discountPaise: 0, shippingPaise: 0 },
    );
    return { granularity: g, from: start, to: end, series, totals };
  }

  // Every order in the dates as a spreadsheet, with the GST split an accountant needs.
  @Get("report")
  async report(@Res({ passthrough: true }) res: Response, @Query("from") from?: string, @Query("to") to?: string) {
    const { start, end } = dateRange(from, to);
    const { orders, settings } = await loadReportData(this.prisma, start, end);
    const day = (d: Date) => new Date(d.getTime() + 19_800_000).toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="sales-report-${day(start)}_${day(new Date(end.getTime() - 1))}.csv"`);
    return "\uFEFF" + salesReportCsv(orders, settings);
  }

  // Order mix, payment mix, best categories and products for the dates, plus the current delivery backlog.
  @Get("overview")
  async overview(@Query("from") from?: string, @Query("to") to?: string) {
    const { start, end } = dateRange(from, to);
    const soldInRange = Prisma.sql`o.status::text NOT IN ${SOLD_EXCLUDED} AND o."createdAt" >= ${start} AND o."createdAt" < ${end}`;

    const [statuses, payments, categories, products, backlog, refunds] = await Promise.all([
      this.prisma.$queryRaw<{ status: string; orders: number; value: bigint }[]>`
        SELECT status::text, COUNT(*)::int AS orders, COALESCE(SUM("totalPaise"), 0)::bigint AS value
        FROM "Order" WHERE "createdAt" >= ${start} AND "createdAt" < ${end} GROUP BY status`,
      this.prisma.$queryRaw<{ method: string; orders: number; value: bigint }[]>`
        SELECT o."paymentMethod" AS method, COUNT(*)::int AS orders, COALESCE(SUM(o."totalPaise"), 0)::bigint AS value
        FROM "Order" o WHERE ${soldInRange} GROUP BY o."paymentMethod"`,
      this.prisma.$queryRaw<{ name: string; revenue: bigint; units: number }[]>`
        SELECT COALESCE(pc.name, c.name) AS name, SUM(${itemRevenue})::bigint AS revenue, SUM(oi.quantity)::int AS units
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId" JOIN "Product" p ON p.id = oi."productId"
        JOIN "Category" c ON c.id = p."categoryId" LEFT JOIN "Category" pc ON pc.id = c."parentId"
        WHERE ${soldInRange} GROUP BY 1 ORDER BY revenue DESC`,
      this.prisma.$queryRaw<{ id: string; name: string; revenue: bigint; units: number }[]>`
        SELECT p.id, p.name, SUM(${itemRevenue})::bigint AS revenue, SUM(oi.quantity)::int AS units
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId" JOIN "Product" p ON p.id = oi."productId"
        WHERE ${soldInRange} GROUP BY p.id, p.name ORDER BY revenue DESC LIMIT 6`,
      this.prisma.$queryRaw<{ status: string; orders: number; value: bigint; oldest: Date }[]>`
        SELECT status::text, COUNT(*)::int AS orders, COALESCE(SUM("totalPaise"), 0)::bigint AS value, MIN("createdAt") AS oldest
        FROM "Order" WHERE status::text IN ('PLACED','PAID','SHIPPED','PENDING_PAYMENT') GROUP BY status`,
      this.prisma.$queryRaw<{ refunded: bigint }[]>`
        SELECT COALESCE(SUM("refundedPaise"), 0)::bigint AS refunded FROM "Order" WHERE "createdAt" >= ${start} AND "createdAt" < ${end}`,
    ]);

    const b = new Map(backlog.map((r) => [r.status, r]));
    const bucket = (...keys: string[]) => {
      const rows = keys.map((k) => b.get(k)).filter((r): r is NonNullable<typeof r> => !!r);
      const oldest = rows.reduce<Date | null>((min, r) => (!min || r.oldest < min ? r.oldest : min), null);
      return { orders: rows.reduce((s, r) => s + r.orders, 0), valuePaise: rows.reduce((s, r) => s + n(r.value), 0), oldest };
    };

    return {
      statuses: statuses.map((r) => ({ status: r.status, orders: r.orders, valuePaise: n(r.value) })),
      payments: payments.map((r) => ({ method: r.method, orders: r.orders, valuePaise: n(r.value) })),
      categories: categories.map((r) => ({ name: r.name, revenuePaise: n(r.revenue), units: r.units })),
      topProducts: products.map((r) => ({ id: r.id, name: r.name, revenuePaise: n(r.revenue), units: r.units })),
      // Not limited to the chosen dates: this is what still needs doing today.
      backlog: { toShip: bucket("PLACED", "PAID"), inTransit: bucket("SHIPPED"), awaitingPayment: bucket("PENDING_PAYMENT") },
      refundedPaise: n(refunds[0]?.refunded),
    };
  }

  // Every order with its exact time, for the order log and the hover details on charts.
  @Get("orders")
  async orders(@Query("scope") scope?: string, @Query("from") from?: string, @Query("to") to?: string) {
    const where = scope === "pending"
      ? Prisma.sql`o.status::text IN ${UNDELIVERED}`
      : (() => { const { start, end } = dateRange(from, to); return Prisma.sql`o."createdAt" >= ${start} AND o."createdAt" < ${end}`; })();
    const LIMIT = 500;

    const rows = await this.prisma.$queryRaw<{
      id: string; createdAt: Date; hour: string; status: string; method: string; total: bigint; discount: bigint; shipping: bigint; customer: string; units: number; margin: bigint;
    }[]>`
      SELECT o.id, o."createdAt", to_char(${istTime}, 'YYYY-MM-DD HH24') AS hour,
             o.status::text AS status, o."paymentMethod" AS method, o."totalPaise" AS total, o."discountPaise" AS discount, o."shippingPaise" AS shipping,
             u.name AS customer, COALESCE(SUM(oi.quantity), 0)::int AS units,
             COALESCE(SUM(oi.quantity * (oi."pricePaise" - COALESCE(oi."costPaise", oi."pricePaise"))), 0)::bigint AS margin
      FROM "Order" o JOIN "User" u ON u.id = o."userId" LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
      WHERE ${where} GROUP BY o.id, u.name ORDER BY o."createdAt" DESC LIMIT ${LIMIT + 1}`;

    return {
      truncated: rows.length > LIMIT,
      orders: rows.slice(0, LIMIT).map((r) => ({
        id: r.id, createdAt: r.createdAt, hour: r.hour, status: r.status, paymentMethod: r.method, totalPaise: n(r.total),
        discountPaise: n(r.discount), shippingPaise: n(r.shipping), customer: r.customer, units: r.units, profitPaise: n(r.margin) - n(r.discount),
      })),
    };
  }

  // Per-product engagement: views, wishlists, sales, reviews, affiliate clicks.
  @Get("products")
  async products(@Query("q") q?: string, @Query("categoryId") categoryId?: string, @Query("from") from?: string, @Query("to") to?: string) {
    const { start, end } = dateRange(from, to);
    const products = await this.prisma.product.findMany({
      where: {
        ...(categoryId && { categoryId }),
        ...(q && { OR: [{ name: { contains: q.slice(0, 100), mode: "insensitive" } }, { brand: { contains: q.slice(0, 100), mode: "insensitive" } }] }),
      },
      select: { id: true, name: true, slug: true, productType: true, status: true, pricePaise: true, category: { select: { id: true, name: true } }, images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } },
      orderBy: { name: "asc" },
    });
    const ids = products.map((p) => p.id);
    if (ids.length === 0) return [];

    const [views, sold, wishlists, reviews, clicks] = await Promise.all([
      this.prisma.$queryRaw<{ productId: string; views: number; visitors: number }[]>`
        SELECT "productId", COUNT(*)::int AS views, COUNT(DISTINCT "visitorId")::int AS visitors
        FROM "ProductView" WHERE "productId" IN (${Prisma.join(ids)}) AND "createdAt" >= ${start} AND "createdAt" < ${end}
        GROUP BY "productId"`,
      this.prisma.$queryRaw<{ productId: string; units: number; orders: number; revenue: bigint; cost: bigint }[]>`
        SELECT oi."productId", SUM(oi.quantity)::int AS units, COUNT(DISTINCT oi."orderId")::int AS orders,
               SUM(${itemRevenue})::bigint AS revenue,
               SUM(oi.quantity * COALESCE(oi."costPaise", oi."pricePaise"))::bigint AS cost
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
        WHERE oi."productId" IN (${Prisma.join(ids)}) AND o.status::text NOT IN ${SOLD_EXCLUDED} AND o."createdAt" >= ${start} AND o."createdAt" < ${end}
        GROUP BY oi."productId"`,
      this.prisma.wishlistItem.groupBy({ by: ["productId"], where: { productId: { in: ids } }, _count: { _all: true } }),
      this.prisma.review.groupBy({ by: ["productId"], where: { productId: { in: ids } }, _avg: { rating: true }, _count: { _all: true } }),
      this.prisma.affiliateClick.groupBy({ by: ["productId"], where: { productId: { in: ids }, createdAt: { gte: start, lt: end } }, _count: { _all: true } }),
    ]);

    const v = new Map(views.map((r) => [r.productId, r]));
    const s = new Map(sold.map((r) => [r.productId, r]));
    const w = new Map(wishlists.map((r) => [r.productId, r._count._all]));
    const r = new Map(reviews.map((x) => [x.productId, x]));
    const c = new Map(clicks.map((x) => [x.productId, x._count._all]));

    return products.map((p) => ({
      id: p.id, name: p.name, slug: p.slug, productType: p.productType, status: p.status, image: p.images[0]?.url ?? null,
      category: p.category,
      views: v.get(p.id)?.views ?? 0,
      visitors: v.get(p.id)?.visitors ?? 0,
      unitsSold: s.get(p.id)?.units ?? 0,
      orderCount: s.get(p.id)?.orders ?? 0,
      revenuePaise: n(s.get(p.id)?.revenue),
      profitPaise: n(s.get(p.id)?.revenue) - n(s.get(p.id)?.cost),
      wishlistCount: w.get(p.id) ?? 0,
      reviewCount: r.get(p.id)?._count._all ?? 0,
      ratingAvg: r.get(p.id)?._avg.rating ? Math.round(r.get(p.id)!._avg.rating! * 10) / 10 : null,
      affiliateClicks: c.get(p.id) ?? 0,
    }));
  }
}
