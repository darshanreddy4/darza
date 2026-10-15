export type Granularity = "hour" | "day" | "month";

export interface SalesPoint { period: string; orders: number; units: number; revenuePaise: number; profitPaise: number; discountPaise: number; shippingPaise: number }
export interface OrderRow {
  id: string; createdAt: string; hour: string; status: string; paymentMethod: string; totalPaise: number; discountPaise: number; shippingPaise: number;
  customer: string; units: number; profitPaise: number;
}

export const SOLD_STATUSES = ["PLACED", "PAID", "SHIPPED", "DELIVERED"];
export const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment", PLACED: "Placed", PAID: "Paid", SHIPPED: "Shipped", DELIVERED: "Delivered", CANCELLED: "Cancelled", REFUNDED: "Refunded",
};
export const STATUS_COLOR: Record<string, string> = {
  PENDING_PAYMENT: "#94a3b8", PLACED: "#f59e0b", PAID: "#10b981", SHIPPED: "#0ea5e9", DELIVERED: "#047857", CANCELLED: "#ef4444", REFUNDED: "#a855f7",
};

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const orderRef = (id: string) => `#${id.slice(-8).toUpperCase()}`;

// Bucket keys are plain calendar strings in India time ("2026-10-12 15", "2026-10-12", "2026-10"), so they are read as UTC to avoid any time zone shift.
const asDate = (key: string) => new Date(`${key.slice(0, 10)}T${key.length >= 13 ? key.slice(11, 13) : "00"}:00:00Z`);
const monthDate = (key: string) => new Date(`${key}-01T00:00:00Z`);
const f = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { ...o, timeZone: "UTC" }).format(d);

// Fills gaps so hours, days and months with no sales still appear as empty columns.
export function fillSeries(series: SalesPoint[], from: string, to: string, g: Granularity): SalesPoint[] {
  const by = new Map(series.map((s) => [s.period, s]));
  const empty = (period: string): SalesPoint => ({ period, orders: 0, units: 0, revenuePaise: 0, profitPaise: 0, discountPaise: 0, shippingPaise: 0 });
  const out: SalesPoint[] = [];
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);

  if (g === "month") {
    for (let d = new Date(start); d.getTime() <= end && out.length < 400; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
      const key = day(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).slice(0, 7);
      out.push(by.get(key) ?? empty(key));
    }
    return out;
  }
  for (let t = start; t <= end && out.length < 800; t += 86_400_000) {
    if (g === "day") out.push(by.get(day(t)) ?? empty(day(t)));
    else for (let h = 0; h < 24; h++) { const key = `${day(t)} ${pad(h)}`; out.push(by.get(key) ?? empty(key)); }
  }
  return out;
}

// "Mon, 12 Oct 2026 · 3:00 PM – 4:00 PM", "Monday, 12 Oct 2026" or "October 2026".
export function periodTitle(p: string, g: Granularity) {
  if (g === "month") return f(monthDate(p), { month: "long", year: "numeric" });
  const d = asDate(p);
  const date = f(d, { day: "numeric", month: "short", year: "numeric" });
  if (g === "day") return `${f(d, { weekday: "long" })}, ${date}`;
  const next = new Date(d.getTime() + 3_600_000);
  return `${f(d, { weekday: "short" })}, ${date} · ${f(d, { hour: "numeric", minute: "2-digit" })} – ${f(next, { hour: "numeric", minute: "2-digit" })}`;
}

export function periodLabel(p: string, g: Granularity) {
  if (g === "month") return f(monthDate(p), { month: "short", year: "numeric" });
  const d = asDate(p);
  return g === "day" ? f(d, { day: "numeric", month: "short" }) : f(d, { hour: "numeric", hour12: true });
}

export const periodDate = (p: string, g: Granularity) => (g === "month" ? f(monthDate(p), { month: "short", year: "numeric" }) : f(asDate(p), { day: "numeric", month: "short", year: "numeric" }));

const IST = "Asia/Kolkata";
export const orderTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: IST });
export const orderDateTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: IST });

export function bucketOf(o: OrderRow, g: Granularity) {
  return g === "hour" ? o.hour : g === "day" ? o.hour.slice(0, 10) : o.hour.slice(0, 7);
}

// Compact rupee labels for chart axes: 1.2K, 3.4L (lakh), 1.1Cr (crore).
export function compactInr(paise: number) {
  const r = paise / 100;
  const t = (v: number) => String(Math.round(v * 10) / 10);
  if (r >= 1e7) return `₹${t(r / 1e7)}Cr`;
  if (r >= 1e5) return `₹${t(r / 1e5)}L`;
  if (r >= 1e3) return `₹${t(r / 1e3)}K`;
  return `₹${Math.round(r)}`;
}

// Rounds the top of an axis up to a tidy number so the gridlines land on round values.
export function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { max: ticks, step: 1 };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return { max: step * ticks, step };
}

export function ageLabel(iso: string, now = Date.now()) {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return h < 48 ? `${h}h ${mins % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}
