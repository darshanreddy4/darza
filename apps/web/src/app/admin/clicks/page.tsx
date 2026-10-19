"use client";

import { useState } from "react";
import { useAdminQuery, type ClickRow } from "@/lib/admin";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, StatCard, inputCls, td, th } from "@/components/admin/ui";
import { Select } from "@/components/Select";

export default function ClicksPage() {
  const [days, setDays] = useState("30");
  const { data, error, loading } = useAdminQuery<ClickRow[]>(`/admin/reports/clicks?days=${days}`);
  const rows = data ?? [];
  const total = rows.reduce((n, r) => n + r.clicks, 0);
  const byPlatform = new Map<string, number>();
  rows.forEach((r) => byPlatform.set(r.platform ?? "Unknown", (byPlatform.get(r.platform ?? "Unknown") ?? 0) + r.clicks));

  return (
    <>
      <PageHeader
        title="Affiliate clicks"
        description="Outbound clicks recorded when visitors use “Buy on …” buttons."
        actions={
          <Select value={days} onChange={(e) => setDays(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Date range">
            <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option>
          </Select>
        }
      />
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total clicks" value={loading ? "–" : total.toLocaleString("en-IN")} tone="brand" />
        <StatCard label="Products clicked" value={loading ? "–" : new Set(rows.map((r) => r.product?.slug)).size} />
        {[...byPlatform.entries()].sort((a, b) => b[1] - a[1]).slice(0, 1).map(([p, n]) => (
          <StatCard key={p} label="Top platform" value={p} hint={`${n} clicks`} tone="gold" />
        ))}
      </div>

      <Card title="By product" className="mt-6" padded={false}>
        {loading ? <Skeleton /> : rows.length === 0 ? <Empty title="No clicks in this period" /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-canvas/60"><th className={th}>Product</th><th className={th}>Platform</th><th className={`${th} text-right`}>Clicks</th><th className={`${th} w-1/3`}>Share</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-canvas/60">
                  <td className={`${td} font-medium`}>{r.product?.name ?? "Deleted product"}</td>
                  <td className={td}><Badge tone="amber">{r.platform ?? "—"}</Badge></td>
                  <td className={`${td} text-right font-semibold`}>{r.clicks}</td>
                  <td className={td}><div className="h-2 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(r.clicks / total) * 100}%` }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
