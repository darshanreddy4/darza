"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/api";
import { useState } from "react";
import { useAdminApi, useAdminQuery, type AdminProduct, type ClickRow } from "@/lib/admin";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, StatCard, btn, td, th } from "@/components/admin/ui";
import { attentionGroups, lowOptions, useStockSettings, type AttentionGroup } from "@/lib/attention";
import { useBrand } from "@/components/BrandProvider";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Workspace } from "@/components/admin/Workspace";

// The business snapshot is for roles that may see both the catalogue and the figures; everyone else gets a start page of what their role covers.
export default function AdminStart() {
  const { user } = useAuth();
  return can(user, "analytics.view") && can(user, "products.view") ? <AdminOverview /> : <Workspace />;
}

function AdminOverview() {
  const brand = useBrand();
  const { user } = useAuth();
  const products = useAdminQuery<AdminProduct[]>("/admin/products");
  const clicks = useAdminQuery<ClickRow[]>("/admin/reports/clicks?days=30");
  const sales = useAdminQuery<{ totals: { orders: number; units: number; revenuePaise: number; profitPaise: number } }>("/admin/analytics/sales?granularity=day");
  const st = sales.data?.totals;

  const list = products.data ?? [];
  const published = list.filter((p) => p.status === "PUBLISHED").length;
  const own = list.filter((p) => p.productType === "OWN");
  const totalClicks = (clicks.data ?? []).reduce((n, c) => n + c.clicks, 0);
  const drafts = list.filter((p) => p.status === "DRAFT");
  const { threshold, optionAlerts } = useStockSettings();
  const groups = attentionGroups(list, threshold, optionAlerts);
  const topClicks = (clicks.data ?? []).slice(0, 5);
  const maxClicks = Math.max(1, ...topClicks.map((c) => c.clicks));

  return (
    <>
      <PageHeader
        title="Overview"
        description="A snapshot of your catalogue and affiliate performance."
        actions={can(user, "products.edit") ? <Link href="/admin/products/new" className={btn.primary}>+ Add product</Link> : undefined}
      />
      {(products.error || clicks.error) && <Alert tone="error">{products.error || clicks.error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total products" value={products.loading ? "–" : list.length} hint={`${published} published · ${drafts.length} drafts`} />
        <StatCard label={`Sold by ${brand}`} value={products.loading ? "–" : own.length} hint="Direct checkout items" tone="brand" />
        <StatCard label="Affiliate products" value={products.loading ? "–" : list.length - own.length} hint="Redirect to partners" tone="gold" />
        <StatCard label="Affiliate clicks (30d)" value={clicks.loading ? "–" : totalClicks.toLocaleString("en-IN")} hint="Tracked outbound visits" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue (30d)" value={st ? formatPrice(st.revenuePaise) : "–"} hint={`${st?.orders ?? 0} ${st?.orders === 1 ? "order" : "orders"}`} />
        <StatCard label="Profit (30d)" value={st ? formatPrice(st.profitPaise) : "–"} tone="brand" hint="Based on product cost prices" />
        <StatCard label="Units sold (30d)" value={st?.units ?? "–"} tone="gold" />
        <Link href="/admin/analytics" className="flex items-center justify-between rounded-2xl bg-ink p-5 text-white shadow-card transition hover:bg-ink-3">
          <span><span className="block text-xs font-semibold uppercase tracking-wider text-white/60">Deep dive</span><span className="mt-2 block font-display text-xl font-bold">Sales & engagement →</span></span>
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card title="Top affiliate products" description="Last 30 days" className="lg:col-span-3" actions={<Link href="/admin/clicks" className="text-sm font-medium text-brand-700 hover:underline">Full report →</Link>}>
          {clicks.loading ? <Skeleton rows={3} /> : topClicks.length === 0 ? (
            <Empty title="No clicks yet">Clicks appear here once visitors use “Buy on …” buttons.</Empty>
          ) : (
            <ul className="space-y-4">
              {topClicks.map((c, i) => (
                <li key={i}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="truncate font-medium">{c.product?.name} <span className="font-normal text-muted">· {c.platform}</span></span>
                    <span className="font-semibold">{c.clicks}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-linear-to-r from-brand-500 to-gold" style={{ width: `${(c.clicks / maxClicks) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Needs attention" className="lg:col-span-2" padded={false} actions={<Link href="/admin/attention" className="text-sm font-medium text-brand-700 hover:underline">Full review →</Link>}>
          {products.loading ? <Skeleton rows={3} /> : (
            <ul className="divide-y divide-line text-sm">
              {groups.map((g) => <Attention key={g.id} group={g} threshold={threshold} />)}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Recently updated" className="mt-6" padded={false} actions={<Link href="/admin/products" className="text-sm font-medium text-brand-700 hover:underline">All products →</Link>}>
        {products.loading ? <Skeleton /> : list.length === 0 ? <Empty title="No products yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line"><th className={th}>Product</th><th className={th}>Type</th><th className={th}>Price</th><th className={th}>Status</th></tr></thead>
              <tbody className="divide-y divide-line">
                {list.slice(0, 5).map((p) => (
                  <tr key={p.id} className="hover:bg-canvas/60">
                    <td className={td}><Link href={`/admin/products/${p.id}`} className="font-medium hover:text-brand-700">{p.name}</Link></td>
                    <td className={td}>{p.productType === "OWN" ? <Badge tone="green">{brand}</Badge> : <Badge tone="amber">{p.platform}</Badge>}</td>
                    <td className={td}>{formatPrice(p.pricePaise)}</td>
                    <td className={td}><Badge tone={p.status === "PUBLISHED" ? "green" : "slate"}>{p.status === "PUBLISHED" ? "Published" : "Draft"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {can(user, "settings.manage") && <SearchIndexCard />}
    </>
  );
}

function SearchIndexCard() {
  const call = useAdminApi();
  const status = useAdminQuery<{ enabled: boolean; healthy: boolean; documents: number }>("/admin/search/status");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const s = status.data;

  async function rebuild() {
    setBusy(true); setError("");
    try { await call("/admin/search/reindex", { method: "POST" }); status.reload(); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  return (
    <Card title="Search" description="Typo-tolerant product search powered by Meilisearch." className="mt-6"
      actions={s?.enabled ? <button onClick={rebuild} disabled={busy} className={btn.secondary}>{busy ? "Rebuilding…" : "Rebuild index"}</button> : undefined}>
      {status.loading ? <p className="text-sm text-muted">Checking…</p> : !s?.enabled ? (
        <p className="text-sm text-muted">Meilisearch is not configured, so search uses the database (no typo tolerance). Set <code>MEILI_URL</code> and <code>MEILI_MASTER_KEY</code> in the API settings to enable it.</p>
      ) : (
        <p className="flex items-center gap-3 text-sm">
          <Badge tone={s.healthy ? "green" : "red"}>{s.healthy ? "Connected" : "Unreachable — using database search"}</Badge>
          {s.healthy && <span className="text-muted">{s.documents} products indexed. New and edited products are indexed automatically.</span>}
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

function Attention({ group, threshold }: { group: AttentionGroup; threshold: number }) {
  const count = group.products.length;
  const items = group.products.map((p) => (group.id !== "stock" ? p.name : (p.stock ?? 0) > threshold ? `${p.name} (${lowOptions(p, threshold).map((o) => `${o.label}: ${o.stock}`).join(", ")})` : `${p.name} (${p.stock ?? 0})`));
  const row = (
    <>
      <div className="flex items-center justify-between">
        <span className="font-medium">{group.label}</span>
        <Badge tone={count === 0 ? "green" : group.tone}>{count === 0 ? "All good" : count}</Badge>
      </div>
      {count > 0 && <p className="mt-1 truncate text-xs text-muted">{items.slice(0, 3).join(", ")}{items.length > 3 ? ` +${items.length - 3} more` : ""}</p>}
    </>
  );
  return (
    <li>
      {count === 0 ? <div className="px-5 py-3.5">{row}</div> : <Link href={`/admin/attention#${group.id}`} className="block px-5 py-3.5 hover:bg-canvas/60">{row}</Link>}
    </li>
  );
}
