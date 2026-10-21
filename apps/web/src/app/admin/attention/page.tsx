"use client";

import Link from "next/link";
import { formatPrice, imgSrc } from "@/lib/api";
import { useAdminQuery, type AdminProduct } from "@/lib/admin";
import { attentionGroups, lowOptions, useStockSettings, type AttentionGroup } from "@/lib/attention";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, btn } from "@/components/admin/ui";
import { useBrand } from "@/components/BrandProvider";

function Reason({ group, p, waiting, threshold }: { group: AttentionGroup; p: AdminProduct; waiting: number; threshold: number }) {
  // The product as a whole is fine; only some of its options are running low.
  if (group.id === "stock" && (p.stock ?? 0) > threshold) return <span className="flex flex-wrap justify-end gap-1.5">{lowOptions(p, threshold).map((o) => <Badge key={o.id} tone={o.stock === 0 ? "red" : "amber"}>{o.label}: {o.stock === 0 ? "out" : `${o.stock} left`}</Badge>)}</span>;
  if (group.id === "stock") return (p.stock ?? 0) === 0 ? <span className="flex items-center gap-2">{waiting > 0 && <Badge tone="slate">{waiting} waiting for it</Badge>}<Badge tone="red">Out of stock</Badge></span> : <Badge tone="amber">Only {p.stock} left</Badge>;
  if (group.id === "drafts") return <Badge tone="slate">Draft</Badge>;
  return <Badge tone="amber">No images</Badge>;
}

export default function AttentionPage() {
  const brand = useBrand();
  const products = useAdminQuery<AdminProduct[]>("/admin/products");
  const alerts = useAdminQuery<{ productId: string; waiting: number }[]>("/admin/stock-alerts");
  const waiting = new Map((alerts.data ?? []).map((a) => [a.productId, a.waiting]));
  const { threshold, optionAlerts } = useStockSettings();
  const groups = attentionGroups(products.data ?? [], threshold, optionAlerts);
  const total = new Set(groups.flatMap((g) => g.products.map((p) => p.id))).size;

  return (
    <>
      <PageHeader
        title="Needs attention"
        description={products.loading ? "Checking your catalogue…" : total === 0 ? "Nothing needs your attention right now." : `${total} ${total === 1 ? "product needs" : "products need"} a look. A product can appear in more than one list.`}
        actions={<Link href="/admin" className="text-sm text-muted hover:text-ink">← Back to overview</Link>}
      />
      {products.error && <Alert tone="error">{products.error}</Alert>}

      <div className="space-y-6">
        {groups.map((g) => (
          <Card key={g.id} title={g.label} description={g.help} padded={false} actions={<Badge tone={g.products.length === 0 ? "green" : g.tone}>{g.products.length === 0 ? "All good" : g.products.length}</Badge>}>
            <div id={g.id} className="scroll-mt-24" />
            {products.loading ? <Skeleton rows={2} /> : g.products.length === 0 ? (
              <Empty title="All good">No products in this list.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {g.products.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-canvas ring-1 ring-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.images[0] && <img src={imgSrc(p.images[0].url)} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/products/${p.id}`} className="block truncate font-medium hover:text-brand-700">{p.name}</Link>
                      <p className="truncate text-xs text-muted">{p.productType === "OWN" ? `Sold by ${brand}${p.sku ? ` · ${p.sku}` : ""}` : `Partner · ${p.platform}`} · {formatPrice(p.pricePaise)}</p>
                    </div>
                    <Reason group={g} p={p} waiting={waiting.get(p.id) ?? 0} threshold={threshold} />
                    <Link href={`/admin/products/${p.id}`} className={btn.secondary + " !px-3 !py-1.5"}>Fix</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
