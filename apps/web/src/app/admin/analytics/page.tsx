"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { API_URL, formatPrice } from "@/lib/api";
import { useAdminApi, useAdminQuery, type AdminCategory } from "@/lib/admin";
import { categoryOptions } from "@/lib/categories";
import {
  ageLabel, fillSeries, orderDateTime, orderRef, periodTitle, STATUS_COLOR, STATUS_LABEL, ymd,
  type Granularity, type OrderRow, type SalesPoint,
} from "@/lib/analytics";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, StatCard, btn, inputCls, td, th } from "@/components/admin/ui";
import { DonutChart, HBars, TrendChart, type Series } from "@/components/admin/charts";
import { Stars } from "@/components/Stars";
import { useBrand } from "@/components/BrandProvider";
import { Select } from "@/components/Select";

interface Sales { granularity: Granularity; series: SalesPoint[]; totals: { orders: number; units: number; revenuePaise: number; profitPaise: number; discountPaise: number; shippingPaise: number } }
interface Bucket { orders: number; valuePaise: number; oldest: string | null }
interface Overview {
  statuses: { status: string; orders: number; valuePaise: number }[];
  payments: { method: string; orders: number; valuePaise: number }[];
  categories: { name: string; revenuePaise: number; units: number }[];
  topProducts: { id: string; name: string; revenuePaise: number; units: number }[];
  backlog: { toShip: Bucket; inTransit: Bucket; awaitingPayment: Bucket };
  refundedPaise: number;
}
interface OrdersResp { truncated: boolean; orders: OrderRow[] }
interface Row {
  id: string; name: string; slug: string; productType: "OWN" | "AFFILIATE"; status: string; image: string | null;
  category: { id: string; name: string }; views: number; visitors: number; unitsSold: number; orderCount: number; revenuePaise: number; profitPaise: number;
  wishlistCount: number; reviewCount: number; ratingAvg: number | null; affiliateClicks: number;
}
interface ReviewRow { id: string; rating: number; title: string | null; body: string; verified: boolean; createdAt: string; user: { name: string; email: string } }

const PRESETS = [
  { id: "today", label: "Today", days: 1, g: "hour" as Granularity },
  { id: "7", label: "7 days", days: 7, g: "day" as Granularity },
  { id: "30", label: "30 days", days: 30, g: "day" as Granularity },
  { id: "90", label: "90 days", days: 90, g: "day" as Granularity },
  { id: "365", label: "12 months", days: 365, g: "month" as Granularity },
];
const MAX_HOURLY_DAYS = 31;
const GRAN_LABEL: Record<Granularity, string> = { hour: "Hourly", day: "Daily", month: "Monthly" };
const CATEGORY_COLORS = ["#0f172a", "#10b981", "#f59e0b", "#0ea5e9", "#a855f7", "#ef4444", "#64748b"];
const STATUS_ORDER = ["PENDING_PAYMENT", "PLACED", "PAID", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];

function presetRange(days: number, g: Granularity) {
  const to = new Date();
  const from = new Date();
  if (g === "month") { from.setDate(1); from.setMonth(from.getMonth() - 11); } else from.setDate(from.getDate() - (days - 1));
  return { from: ymd(from), to: ymd(to) };
}
const dayCount = (r: { from: string; to: string }) => Math.round((Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000) + 1;

type SortKey = "name" | "views" | "visitors" | "wishlistCount" | "unitsSold" | "revenuePaise" | "profitPaise" | "ratingAvg" | "conversion";
type Eng = Row & { conversion: number | null };

export default function AnalyticsPage() {
  const [preset, setPreset] = useState("30");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [range, setRange] = useState(() => presetRange(30, "day"));
  const [mode, setMode] = useState<"bars" | "line">("bars");
  const [now] = useState(() => Date.now());
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState("");

  const hourlyOk = dayCount(range) <= MAX_HOURLY_DAYS;
  const g: Granularity = granularity === "hour" && !hourlyOk ? "day" : granularity;
  const query = `from=${range.from}&to=${range.to}`;
  const sales = useAdminQuery<Sales>(`/admin/analytics/sales?granularity=${g}&${query}`);
  const overview = useAdminQuery<Overview>(`/admin/analytics/overview?${query}`);
  const log = useAdminQuery<OrdersResp>(`/admin/analytics/orders?${query}`);
  const pending = useAdminQuery<OrdersResp>("/admin/analytics/orders?scope=pending");

  const points = useMemo(() => (sales.data ? fillSeries(sales.data.series, range.from, range.to, sales.data.granularity) : []), [sales.data, range]);
  const t = sales.data?.totals;
  const o = overview.data;
  const margin = t && t.revenuePaise > 0 ? Math.round((t.profitPaise / t.revenuePaise) * 100) : 0;
  const aov = t && t.orders > 0 ? Math.round(t.revenuePaise / t.orders) : 0;

  function choosePreset(id: string) {
    const p = PRESETS.find((x) => x.id === id)!;
    setPreset(id); setGranularity(p.g); setRange(presetRange(p.days, p.g));
  }
  function customRange(next: { from: string; to: string }) {
    setPreset("custom"); setRange(next);
    const days = dayCount(next);
    setGranularity(days <= 2 ? "hour" : days <= 92 ? "day" : "month");
  }

  // Every order in the chosen dates, not just the ones listed below.
  async function downloadReport() {
    setReportError(""); setReporting(true);
    try {
      const res = await fetch(`${API_URL}/admin/analytics/report?from=${range.from}&to=${range.to}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Could not prepare the report (${res.status})`);
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: `sales-report-${range.from}_${range.to}.csv` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setReportError((e as Error).message); } finally { setReporting(false); }
  }

  const money = (v: number) => formatPrice(v);
  const moneySeries: Series[] = [
    { key: "revenue", label: "Revenue", color: "#0f172a", value: (p) => p.revenuePaise, format: money },
    { key: "profit", label: "Profit", color: "#10b981", value: (p) => p.profitPaise, format: money },
  ];
  const orderSeries: Series[] = [{ key: "orders", label: "Orders", color: "#0ea5e9", value: (p) => p.orders, format: (v) => String(v) }];

  const statusSlices = STATUS_ORDER.map((s) => ({ key: s, label: STATUS_LABEL[s], color: STATUS_COLOR[s], value: o?.statuses.find((x) => x.status === s)?.orders ?? 0 }));
  const paymentSlices = (o?.payments ?? []).map((p) => ({ key: p.method, label: p.method === "COD" ? "Pay on delivery" : "Paid online", color: p.method === "COD" ? "#f59e0b" : "#10b981", value: p.valuePaise }));
  const categorySlices = (o?.categories ?? []).map((c, i) => ({ key: c.name, label: c.name, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length], value: c.revenuePaise }));

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Sales, profit, orders and customer engagement. Times are in India time."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-line bg-white text-sm" role="group" aria-label="Date range">
              {PRESETS.map((p) => (
                <button key={p.id} onClick={() => choosePreset(p.id)} aria-pressed={preset === p.id} className={`px-3 py-2 font-medium ${preset === p.id ? "bg-ink text-white" : "hover:bg-canvas"}`}>{p.label}</button>
              ))}
            </div>
            <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && customRange({ ...range, from: e.target.value })} className={`${inputCls} !w-auto`} aria-label="From date" />
            <span className="text-muted">→</span>
            <input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && customRange({ ...range, to: e.target.value })} className={`${inputCls} !w-auto`} aria-label="To date" />
            <button type="button" onClick={downloadReport} disabled={reporting} className={btn.secondary}>{reporting ? "Preparing…" : "Download sales report"}</button>
          </div>
        }
      />
      {(sales.error || overview.error || log.error || reportError) && <Alert tone="error">{sales.error || overview.error || log.error || reportError}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={t ? formatPrice(t.revenuePaise) : "–"} hint={t ? `After ${formatPrice(t.discountPaise)} discounts` : undefined} />
        <StatCard label="Profit" value={t ? formatPrice(t.profitPaise) : "–"} hint={t ? `${margin}% margin` : undefined} tone="brand" />
        <StatCard label="Orders" value={t?.orders ?? "–"} hint={t ? `${formatPrice(aov)} average order` : undefined} tone="gold" />
        <StatCard label="Units sold" value={t?.units ?? "–"} hint="Excludes cancelled & refunded" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BacklogCard label="To ship" hint="Placed or paid, not shipped yet" bucket={o?.backlog.toShip} tone="red" now={now} />
        <BacklogCard label="On the way" hint="Shipped, not delivered yet" bucket={o?.backlog.inTransit} tone="gold" now={now} />
        <BacklogCard label="Awaiting payment" hint="Online orders not paid yet" bucket={o?.backlog.awaitingPayment} tone="ink" now={now} />
        <StatCard label="Refunded" value={o ? formatPrice(o.refundedPaise) : "–"} hint="Sent back through Razorpay" />
      </div>

      <Card
        title="Revenue and profit"
        description="Hover a bar or point for the exact date and time, the totals and the orders in it. Profit is after cost price and coupon discounts."
        className="mt-6"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Toggle label="Group by" value={g} options={(["hour", "day", "month"] as const).map((v) => ({ value: v, label: GRAN_LABEL[v], disabled: v === "hour" && !hourlyOk }))} onChange={setGranularity} />
            <Toggle label="Chart type" value={mode} options={[{ value: "bars", label: "Bars" }, { value: "line", label: "Line" }]} onChange={setMode} />
          </div>
        }
      >
        {sales.loading ? <Skeleton rows={4} /> : <TrendChart points={points} granularity={sales.data?.granularity ?? g} series={moneySeries} mode={mode} orders={log.data?.orders} label="Revenue and profit over time" />}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Orders over time" description="How many orders were placed in each period.">
          {sales.loading ? <Skeleton rows={3} /> : <TrendChart points={points} granularity={sales.data?.granularity ?? g} series={orderSeries} mode="bars" orders={log.data?.orders} height={240} tickFormat={(v) => String(Math.round(v))} label="Orders over time" />}
        </Card>
        <Card title="Top products by revenue" description="Best sellers in the selected dates.">
          {overview.loading ? <Skeleton rows={3} /> : <HBars rows={(o?.topProducts ?? []).map((p) => ({ key: p.id, label: p.name, value: p.revenuePaise, display: formatPrice(p.revenuePaise), sub: `${p.units} sold` }))} />}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Orders by status" description="Everything placed in these dates.">
          {overview.loading ? <Skeleton rows={3} /> : <DonutChart slices={statusSlices} centerLabel="Orders" />}
        </Card>
        <Card title="Revenue by category" description="Net of discounts.">
          {overview.loading ? <Skeleton rows={3} /> : <DonutChart slices={categorySlices} centerLabel="Revenue" format={(v) => formatPrice(v)} />}
        </Card>
        <Card title="Payment method" description="Value of sold orders.">
          {overview.loading ? <Skeleton rows={3} /> : <DonutChart slices={paymentSlices} centerLabel="Sales" format={(v) => formatPrice(v)} />}
        </Card>
      </div>

      <Card title="Waiting for delivery" description="Orders that are placed, paid or shipped but not delivered yet, oldest first." className="mt-6" padded={false} actions={<Link href="/admin/orders" className="text-sm font-medium text-brand-700 hover:underline">Manage orders →</Link>}>
        {pending.loading ? <Skeleton rows={3} /> : (pending.data?.orders ?? []).length === 0 ? <Empty title="All caught up">No orders are waiting for delivery.</Empty> : (
          <div className="max-h-96 overflow-auto" tabIndex={0} role="region" aria-label="Orders waiting for delivery">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b border-line"><th className={th}>Placed</th><th className={th}>Order</th><th className={th}>Customer</th><th className={th}>Status</th><th className={`${th} text-right`}>Waiting</th><th className={`${th} text-right`}>Amount</th></tr></thead>
              <tbody className="divide-y divide-line">
                {[...pending.data!.orders].reverse().map((r) => (
                  <tr key={r.id} className="hover:bg-canvas/60">
                    <td className={td}>{orderDateTime(r.createdAt)}</td>
                    <td className={`${td} font-mono text-xs font-semibold`}>{orderRef(r.id)}</td>
                    <td className={td}>{r.customer}</td>
                    <td className={td}><StatusBadge status={r.status} /></td>
                    <td className={`${td} text-right tabular-nums ${now - Date.parse(r.createdAt) > 3 * 86_400_000 ? "font-semibold text-red-600" : ""}`}>{ageLabel(r.createdAt, now)}</td>
                    <td className={`${td} text-right font-medium tabular-nums`}>{formatPrice(r.totalPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <OrderLog data={log.data} loading={log.loading} />

      <Card title={`${{ hour: "Hour", day: "Day", month: "Month" }[sales.data?.granularity ?? g]}-wise sales`} className="mt-6" padded={false}>
        {sales.loading ? <Skeleton rows={3} /> : (sales.data?.series.length ?? 0) === 0 ? <Empty title="No sales in this period" /> : (
          <div className="max-h-96 overflow-auto" tabIndex={0} role="region" aria-label="Sales by period">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b border-line"><th className={th}>{sales.data!.granularity === "hour" ? "Date and hour" : sales.data!.granularity === "day" ? "Date" : "Month"}</th><th className={`${th} text-right`}>Orders</th><th className={`${th} text-right`}>Units</th><th className={`${th} text-right`}>Discounts</th><th className={`${th} text-right`}>Revenue</th><th className={`${th} text-right`}>Profit</th></tr></thead>
              <tbody className="divide-y divide-line">
                {[...sales.data!.series].reverse().map((s) => (
                  <tr key={s.period} className="hover:bg-canvas/60">
                    <td className={`${td} font-medium`}>{periodTitle(s.period, sales.data!.granularity)}</td>
                    <td className={`${td} text-right`}>{s.orders}</td><td className={`${td} text-right`}>{s.units}</td>
                    <td className={`${td} text-right text-muted`}>{s.discountPaise > 0 ? formatPrice(s.discountPaise) : "—"}</td>
                    <td className={`${td} text-right`}>{formatPrice(s.revenuePaise)}</td><td className={`${td} text-right font-medium text-brand-700`}>{formatPrice(s.profitPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Engagement range={range} />
    </>
  );
}

function Toggle<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; disabled?: boolean }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-line text-sm" role="group" aria-label={label}>
      {options.map((opt) => (
        <button key={opt.value} disabled={opt.disabled} title={opt.disabled ? "Hourly view covers up to 31 days" : undefined} onClick={() => onChange(opt.value)} aria-pressed={value === opt.value}
          className={`px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40 ${value === opt.value ? "bg-ink text-white" : "hover:bg-canvas"}`}>{opt.label}</button>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[status] }} />{STATUS_LABEL[status] ?? status}</span>;
}

function BacklogCard({ label, hint, bucket, tone, now }: { label: string; hint: string; bucket?: Bucket; tone: "red" | "gold" | "ink"; now: number }) {
  return (
    <Link href="/admin/orders" className="block transition hover:-translate-y-0.5">
      <StatCard label={label} value={bucket ? bucket.orders : "–"} tone={tone}
        hint={bucket ? (bucket.orders === 0 ? "Nothing waiting" : `${formatPrice(bucket.valuePaise)} · oldest ${bucket.oldest ? ageLabel(bucket.oldest, now) : "–"}`) : hint} />
    </Link>
  );
}

function OrderLog({ data, loading }: { data?: OrdersResp | null; loading: boolean }) {
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState(25);
  const rows = (data?.orders ?? []).filter((r) => !status || r.status === status);
  return (
    <Card
      title="Order log" description="Every order in the selected dates with its exact date and time." className="mt-6" padded={false}
      actions={
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setLimit(25); }} className={`${inputCls} !w-auto`} aria-label="Filter orders by status">
          <option value="">All statuses</option>
          {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </Select>
      }
    >
      {loading ? <Skeleton rows={3} /> : rows.length === 0 ? <Empty title="No orders in this period" /> : (
        <>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Orders in this period">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas/60"><th className={th}>Date and time</th><th className={th}>Order</th><th className={th}>Customer</th><th className={th}>Status</th><th className={th}>Payment</th><th className={`${th} text-right`}>Units</th><th className={`${th} text-right`}>Discount</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Profit</th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, limit).map((r) => (
                  <tr key={r.id} className="hover:bg-canvas/60">
                    <td className={`${td} whitespace-nowrap`}>{orderDateTime(r.createdAt)}</td>
                    <td className={`${td} font-mono text-xs font-semibold`}>{orderRef(r.id)}</td>
                    <td className={td}>{r.customer}</td>
                    <td className={td}><StatusBadge status={r.status} /></td>
                    <td className={`${td} text-muted`}>{r.paymentMethod === "COD" ? "On delivery" : "Online"}</td>
                    <td className={`${td} text-right`}>{r.units}</td>
                    <td className={`${td} text-right text-muted`}>{r.discountPaise > 0 ? formatPrice(r.discountPaise) : "—"}</td>
                    <td className={`${td} text-right font-medium tabular-nums`}>{formatPrice(r.totalPaise)}</td>
                    <td className={`${td} text-right tabular-nums text-brand-700`}>{["PENDING_PAYMENT", "CANCELLED", "REFUNDED"].includes(r.status) ? "—" : formatPrice(r.profitPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-muted">
            <span>Showing {Math.min(limit, rows.length)} of {rows.length}{data?.truncated ? "+ (the 500 most recent)" : ""} orders</span>
            {limit < rows.length && <button onClick={() => setLimit((l) => l + 50)} className="font-semibold text-brand-700 hover:underline">Show 50 more</button>}
          </div>
        </>
      )}
    </Card>
  );
}

function Engagement({ range }: { range: { from: string; to: string } }) {
  const brand = useBrand();
  const query = `from=${range.from}&to=${range.to}`;
  const products = useAdminQuery<Row[]>(`/admin/analytics/products?${query}`);
  const cats = useAdminQuery<AdminCategory[]>("/admin/categories");
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [rating, setRating] = useState("");
  const [activity, setActivity] = useState("");
  const [minViews, setMinViews] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "unitsSold", dir: -1 });
  const [open, setOpen] = useState<string | null>(null);

  const catOptions = useMemo(() => categoryOptions(cats.data ?? []), [cats.data]);
  const catLabel = useMemo(() => new Map(catOptions.map((c) => [c.id, c.label])), [catOptions]);

  const rows = useMemo(() => {
    // Choosing a main category also matches products in its subcategories.
    const allowed = new Set([categoryId, ...(cats.data ?? []).filter((c) => c.parentId === categoryId).map((c) => c.id)]);
    const min = Number(minViews) || 0;
    const list: Eng[] = (products.data ?? []).map((p) => ({ ...p, conversion: p.productType === "OWN" && p.visitors > 0 ? (p.orderCount / p.visitors) * 100 : null }));
    return list
      .filter((p) =>
        (!q || p.name.toLowerCase().includes(q.toLowerCase())) && (!categoryId || allowed.has(p.category.id)) &&
        (!type || p.productType === type) && (!status || p.status === status) && p.views >= min &&
        (!rating || (rating === "none" ? p.reviewCount === 0 : rating === "low" ? p.ratingAvg !== null && p.ratingAvg < 3 : p.ratingAvg !== null && p.ratingAvg >= Number(rating))) &&
        (!activity ||
          (activity === "sold" ? p.unitsSold > 0 : activity === "unsold" ? p.productType === "OWN" && p.unitsSold === 0 :
           activity === "browse" ? p.productType === "OWN" && p.views > 0 && p.unitsSold === 0 : activity === "wishlist" ? p.wishlistCount > 0 :
           activity === "clicks" ? p.affiliateClicks > 0 : true)))
      .sort((a, b) => {
        const av = a[sort.key] ?? -1, bv = b[sort.key] ?? -1;
        return (typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * sort.dir;
      });
  }, [products.data, cats.data, q, categoryId, type, status, rating, activity, minViews, sort]);

  const filtered = !!(q || categoryId || type || status || rating || activity || minViews);
  const totals = rows.reduce((s, r) => ({ views: s.views + r.views, sold: s.sold + r.unitsSold, wish: s.wish + r.wishlistCount }), { views: 0, sold: 0, wish: 0 });
  const clear = () => { setQ(""); setCategoryId(""); setType(""); setStatus(""); setRating(""); setActivity(""); setMinViews(""); };

  const header = (key: SortKey, label: string, right = true) => (
    <th className={`${th} ${right ? "text-right" : ""}`} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))} className="py-1.5 uppercase tracking-wider hover:text-ink">
        {label} {sort.key === key ? (sort.dir === 1 ? "↑" : "↓") : ""}
      </button>
    </th>
  );

  function exportCsv() {
    const head = ["Product", "Category", "Type", "Views", "Unique visitors", "Wishlisted", "Units sold", "Conversion %", "Revenue (INR)", "Profit (INR)", "Avg rating", "Reviews", "Affiliate clicks"];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = rows.map((r) => [r.name, catLabel.get(r.category.id) ?? r.category.name, r.productType, r.views, r.visitors, r.wishlistCount, r.unitsSold, r.conversion === null ? "" : r.conversion.toFixed(1), r.revenuePaise / 100, r.profitPaise / 100, r.ratingAvg ?? "", r.reviewCount, r.affiliateClicks].map(esc).join(","));
    const url = URL.createObjectURL(new Blob([[head.map(esc).join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `dmg-products-${range.from}_${range.to}.csv` });
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <Card
      title="Product engagement"
      description="Views, wishlists, sales and reviews per product for the selected dates. Conv. is orders per unique visitor. Wishlist and review counts are all-time."
      className="mt-6" padded={false}
      actions={<button onClick={exportCsv} disabled={rows.length === 0} className={btn.secondary}>Export CSV</button>}
    >
      <div className="space-y-3 border-b border-line p-4">
        <div className="flex flex-wrap gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by product name" className={`${inputCls} max-w-xs`} aria-label="Filter by product name" />
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Filter by category">
            <option value="">All categories</option>
            {catOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Filter by type">
            <option value="">All types</option><option value="OWN">Sold by {brand}</option><option value="AFFILIATE">Affiliate</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Filter by status">
            <option value="">All statuses</option><option value="PUBLISHED">Published</option><option value="DRAFT">Draft</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={activity} onChange={(e) => setActivity(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Filter by activity">
            <option value="">Any activity</option>
            <option value="sold">Has sales</option>
            <option value="unsold">No sales yet</option>
            <option value="browse">Viewed but never bought</option>
            <option value="wishlist">Wishlisted</option>
            <option value="clicks">Has partner clicks</option>
          </Select>
          <Select value={rating} onChange={(e) => setRating(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Filter by rating">
            <option value="">Any rating</option>
            <option value="4">4 stars and up</option><option value="3">3 stars and up</option><option value="low">Under 3 stars</option><option value="none">No reviews</option>
          </Select>
          <label className="flex items-center gap-2 text-xs font-medium text-muted">At least
            <input value={minViews} onChange={(e) => setMinViews(e.target.value)} type="number" min={0} placeholder="0" aria-label="Minimum views" className={`${inputCls} !w-20`} /> views
          </label>
          {filtered && <button onClick={clear} className="text-sm font-medium text-brand-700 hover:underline">Clear filters</button>}
          <span className="ml-auto text-xs text-muted" aria-live="polite">{rows.length} products · {totals.views.toLocaleString("en-IN")} views · {totals.sold} sold</span>
        </div>
      </div>

      {products.loading ? <Skeleton /> : rows.length === 0 ? <Empty title="No products match" /> : (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Product performance">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-canvas/60">
              {header("name", "Product", false)}
              {header("views", "Views")}{header("visitors", "Visitors")}{header("wishlistCount", "Wishlisted")}
              {header("unitsSold", "Sold")}{header("conversion", "Conv.")}{header("revenuePaise", "Revenue")}{header("profitPaise", "Profit")}
              {header("ratingAvg", "Rating")}
            </tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr onClick={() => setOpen(open === r.id ? null : r.id)} className="cursor-pointer hover:bg-canvas/60">
                    <td className={td}>
                      <button type="button" aria-expanded={open === r.id} onClick={(e) => { e.stopPropagation(); setOpen(open === r.id ? null : r.id); }} className="py-1 text-left font-medium hover:text-brand-700">{r.name}</button>
                      <p className="flex items-center gap-2 text-xs text-muted">{catLabel.get(r.category.id) ?? r.category.name} {r.productType === "AFFILIATE" ? <Badge tone="amber">{r.affiliateClicks} partner clicks</Badge> : null}{r.status !== "PUBLISHED" && <Badge>Draft</Badge>}</p>
                    </td>
                    <td className={`${td} text-right`}>{r.views}</td>
                    <td className={`${td} text-right`}>{r.visitors}</td>
                    <td className={`${td} text-right`}>{r.wishlistCount}</td>
                    <td className={`${td} text-right font-semibold`}>{r.productType === "OWN" ? r.unitsSold : <span className="font-normal text-muted">—</span>}</td>
                    <td className={`${td} text-right`}>{r.conversion === null ? <span className="text-muted">—</span> : `${r.conversion.toFixed(1)}%`}</td>
                    <td className={`${td} text-right`}>{r.productType === "OWN" ? formatPrice(r.revenuePaise) : "—"}</td>
                    <td className={`${td} text-right font-medium text-brand-700`}>{r.productType === "OWN" ? formatPrice(r.profitPaise) : "—"}</td>
                    <td className={`${td} text-right`}>
                      {r.ratingAvg !== null ? <span className="inline-flex items-center justify-end gap-1.5"><Stars value={r.ratingAvg} /> {r.ratingAvg} <span className="text-xs text-muted">({r.reviewCount})</span></span> : <span className="text-muted">No reviews</span>}
                    </td>
                  </tr>
                  {open === r.id && <tr><td colSpan={9} className="bg-canvas/60 px-5 py-4"><ProductReviews productId={r.id} /></td></tr>}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ProductReviews({ productId }: { productId: string }) {
  const call = useAdminApi();
  const { data, loading, error, reload } = useAdminQuery<ReviewRow[]>(`/admin/reviews?productId=${productId}`);
  if (loading) return <p className="text-sm text-muted">Loading reviews…</p>;
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data || data.length === 0) return <p className="text-sm text-muted">No reviews for this product yet.</p>;
  return (
    <ul className="space-y-3">
      {data.map((r) => (
        <li key={r.id} className="flex items-start justify-between gap-4 rounded-xl bg-white p-4 text-sm ring-1 ring-line">
          <div>
            <p className="flex items-center gap-2"><Stars value={r.rating} /> {r.title && <strong>{r.title}</strong>} {r.verified && <Badge tone="green">Verified purchase</Badge>}</p>
            <p className="mt-1 text-ink-3">{r.body}</p>
            <p className="mt-1 text-xs text-muted">{r.user.name} · {r.user.email} · {new Date(r.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
          </div>
          <button className={btn.danger} onClick={async () => { if (confirm("Delete this review?")) { await call(`/admin/reviews/${r.id}`, { method: "DELETE" }).catch(() => {}); reload(); } }}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
