"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  bucketOf, compactInr, niceScale, orderRef, orderTime, periodLabel, periodTitle, SOLD_STATUSES,
  type Granularity, type OrderRow, type SalesPoint,
} from "@/lib/analytics";

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    // The observer can be slow to report (for example in a background tab), so take a first reading right away.
    Promise.resolve().then(() => setWidth(Math.floor(el.getBoundingClientRect().width)));
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export interface Series {
  key: string; label: string; color: string;
  value: (p: SalesPoint) => number;
  format: (v: number) => string;
}

const M = { l: 52, r: 12, t: 12, b: 34 };

// Bars or lines over time. Hovering any column shows its exact date (and hour), every series value and the orders placed in it.
export function TrendChart({ points, granularity, series, mode, orders = [], height = 280, tickFormat = compactInr, label }: {
  points: SalesPoint[]; granularity: Granularity; series: Series[]; mode: "bars" | "line"; orders?: OrderRow[];
  height?: number; tickFormat?: (v: number) => string; label: string;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  const innerW = Math.max(0, width - M.l - M.r);
  const innerH = height - M.t - M.b;
  const band = n ? innerW / n : 0;

  const peak = Math.max(0, ...points.flatMap((p) => series.map((s) => s.value(p))));
  const scale = niceScale(peak);
  const y = (v: number) => M.t + innerH - (Math.max(0, v) / scale.max) * innerH;
  const cx = (i: number) => M.l + band * (i + 0.5);
  const hasData = peak > 0;

  const ordersBy = useMemo(() => {
    const m = new Map<string, OrderRow[]>();
    for (const o of orders) {
      if (!SOLD_STATUSES.includes(o.status)) continue;
      const k = bucketOf(o, granularity);
      m.set(k, [...(m.get(k) ?? []), o]);
    }
    for (const list of m.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return m;
  }, [orders, granularity]);

  const labelStep = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / (granularity === "hour" ? 54 : 74)))));
  const ticks = Array.from({ length: 5 }, (_, i) => (scale.max / 4) * i);

  const p = hover !== null ? points[hover] : null;
  const extra = p ? ordersBy.get(p.period) ?? [] : [];
  const tipLeft = hover !== null ? cx(hover) : 0;
  const flip = tipLeft > width * 0.58;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - box.left) / box.width) * n);
    setHover(Math.min(n - 1, Math.max(0, i)));
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
        {series.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}</span>)}
        <span className="ml-auto">Peak {series[0]?.format(peak)}</span>
      </div>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={label} className="block select-none">
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`fill-${label.replace(/\W/g, "")}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.28" /><stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>

            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.l} x2={width - M.r} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeDasharray={t === 0 ? undefined : "3 4"} />
                <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#6b7280">{tickFormat(t)}</text>
              </g>
            ))}

            {mode === "bars" ? points.map((pt, i) => {
              const groupW = Math.min(band * 0.72, 46);
              const barW = groupW / series.length;
              return series.map((s, k) => {
                const h = innerH - (y(s.value(pt)) - M.t);
                return <rect key={`${pt.period}-${s.key}`} x={cx(i) - groupW / 2 + k * barW} y={y(s.value(pt))} width={Math.max(1, barW - 1)} height={Math.max(0, h)} rx={2} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.45} />;
              });
            }) : series.map((s) => {
              const path = points.map((pt, i) => `${i === 0 ? "M" : "L"}${cx(i).toFixed(1)},${y(s.value(pt)).toFixed(1)}`).join(" ");
              return (
                <g key={s.key}>
                  {n > 0 && <path d={`${path} L${cx(n - 1).toFixed(1)},${y(0)} L${cx(0).toFixed(1)},${y(0)} Z`} fill={`url(#fill-${label.replace(/\W/g, "")}-${s.key})`} />}
                  <path d={path} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
                  {hover !== null && <circle cx={cx(hover)} cy={y(s.value(points[hover]))} r="4.5" fill="#fff" stroke={s.color} strokeWidth="2.2" />}
                </g>
              );
            })}

            {hover !== null && <line x1={cx(hover)} x2={cx(hover)} y1={M.t} y2={M.t + innerH} stroke="#111827" strokeOpacity="0.25" />}

            {points.map((pt, i) => i % labelStep === 0 && (
              <text key={pt.period} x={cx(i)} y={height - 16} textAnchor="middle" fontSize="10.5" fill="#6b7280">
                {periodLabel(pt.period, granularity)}
                {granularity === "hour" && (pt.period.endsWith(" 00") || i === 0) && <tspan x={cx(i)} dy="12" fill="#111827" fontWeight="600">{periodTitle(pt.period, "day").split(",")[1]?.trim().replace(/ \d{4}$/, "")}</tspan>}
              </text>
            ))}

            <rect x={M.l} y={M.t} width={innerW} height={innerH} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </svg>
        )}

        {!hasData && width > 0 && <p className="pointer-events-none absolute inset-0 grid place-items-center pb-8 text-sm text-muted">No sales in this period</p>}

        {p && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-2 z-10 w-64 rounded-xl border border-line bg-white p-3 text-xs shadow-lift"
            style={{ left: flip ? undefined : Math.min(tipLeft + 14, Math.max(0, width - 270)), right: flip ? Math.max(0, width - tipLeft + 14) : undefined }}
          >
            <p className="font-semibold leading-snug text-ink">{periodTitle(p.period, granularity)}</p>
            <ul className="mt-2 space-y-1">
              {series.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />{s.label}</span>
                  <span className="font-semibold tabular-nums">{s.format(s.value(p))}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-line pt-2 text-muted">{p.orders} {p.orders === 1 ? "order" : "orders"} · {p.units} {p.units === 1 ? "unit" : "units"}{p.discountPaise > 0 ? ` · ${compactInr(p.discountPaise)} discounts` : ""}</p>
            {extra.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {extra.slice(0, 4).map((o) => (
                  <li key={o.id} className="flex justify-between gap-2 tabular-nums"><span className="text-muted">{orderTime(o.createdAt)} · {orderRef(o.id)}</span><span>{compactInr(o.totalPaise)}</span></li>
                ))}
                {extra.length > 4 && <li className="text-muted">+{extra.length - 4} more</li>}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export interface Slice { key: string; label: string; value: number; color: string }

// Donut with a legend; hovering a slice (or legend row) shows its share in the middle.
export function DonutChart({ slices, centerLabel, format = (v) => String(v), valueLabel }: {
  slices: Slice[]; centerLabel: string; format?: (v: number) => string; valueLabel?: (s: Slice) => string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const live = slices.filter((s) => s.value > 0);
  const total = live.reduce((a, s) => a + s.value, 0);
  const R = 62, W = 24, C = 2 * Math.PI * R;
  const arcs = live.map((s, i) => ({ s, len: (s.value / total) * C, offset: live.slice(0, i).reduce((a, x) => a + (x.value / total) * C, 0) }));
  const current = live.find((s) => s.key === active);

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img" aria-label={`${centerLabel}: ${live.map((s) => `${s.label} ${format(s.value)}`).join(", ") || "no data"}`}>
          <circle cx="80" cy="80" r={R} fill="none" stroke="#f1f5f9" strokeWidth={W} />
          {arcs.map(({ s, len, offset }) => {
            const gap = live.length > 1 ? Math.min(2, len * 0.2) : 0;
            return (
              <circle key={s.key} cx="80" cy="80" r={R} fill="none" stroke={s.color} strokeWidth={active === s.key ? W + 4 : W}
                strokeDasharray={`${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`} strokeDashoffset={-offset}
                opacity={active && active !== s.key ? 0.4 : 1} className="cursor-pointer transition-all"
                onMouseEnter={() => setActive(s.key)} onMouseLeave={() => setActive(null)} />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div className="max-w-[96px]">
            <p className="truncate text-[11px] font-medium text-muted">{current ? current.label : centerLabel}</p>
            <p className="font-display text-xl font-bold tabular-nums">{total === 0 ? "–" : format(current ? current.value : total)}</p>
            {current && total > 0 && <p className="text-[11px] text-muted">{Math.round((current.value / total) * 100)}%</p>}
          </div>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {slices.length === 0 || total === 0 ? <li className="text-muted">No data in this period</li> : live.map((s) => (
          <li key={s.key} onMouseEnter={() => setActive(s.key)} onMouseLeave={() => setActive(null)}
            className={`flex items-center justify-between gap-3 rounded-md px-1.5 py-0.5 ${active === s.key ? "bg-canvas" : ""}`}>
            <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} /><span className="truncate">{s.label}</span></span>
            <span className="shrink-0 tabular-nums"><strong>{valueLabel ? valueLabel(s) : format(s.value)}</strong> <span className="text-xs text-muted">{Math.round((s.value / total) * 100)}%</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface BarRow { key: string; label: string; value: number; display: string; sub?: string }

export function HBars({ rows, color = "#10b981" }: { rows: BarRow[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-muted">No data in this period</p>;
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => (
        <li key={r.key} title={`${r.label}: ${r.display}${r.sub ? ` (${r.sub})` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{r.label}</span>
            <span className="shrink-0 tabular-nums"><strong>{r.display}</strong>{r.sub && <span className="ml-1.5 text-xs text-muted">{r.sub}</span>}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full transition-all" style={{ width: `${(r.value / max) * 100}%`, background: color }} /></div>
        </li>
      ))}
    </ul>
  );
}
