"use client";

import { useEffect, useState } from "react";
import { formatPrice, imgSrc } from "@/lib/api";
import { useAdminQuery, type AdminProduct } from "@/lib/admin";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, inputCls, td, th } from "@/components/admin/ui";

// What staff see of the catalogue: stock and prices to answer customers, with no editing and no costs.
export function StaffProducts() {
  const [q, setQ] = useState("");
  const [typed, setTyped] = useState("");
  useEffect(() => { const t = setTimeout(() => setTyped(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const products = useAdminQuery<AdminProduct[]>(`/admin/products?sort=name&dir=asc${typed ? `&q=${encodeURIComponent(typed)}` : ""}`);
  const rows = products.data ?? [];

  return (
    <>
      <PageHeader title="Products" description="Stock and prices, for answering customers. Changes are made by the catalogue team." />
      {products.error && <Alert tone="error">{products.error}</Alert>}
      <Card padded={false}>
        <div className="border-b border-line p-4">
          <input className={`${inputCls} max-w-xs`} placeholder="Search name, SKU or brand" aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {products.loading ? <Skeleton /> : rows.length === 0 ? <Empty title="No products match">Try another search.</Empty> : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Products">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas/60"><th className={th}>Product</th><th className={th}>SKU</th><th className={`${th} text-right`}>Price</th><th className={`${th} text-right`}>Stock</th><th className={th}>Status</th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-canvas ring-1 ring-line">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.images[0] && <img src={imgSrc(p.images[0].url)} alt="" className="h-full w-full object-cover" />}
                        </span>
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </td>
                    <td className={td}>{p.sku ?? "—"}</td>
                    <td className={`${td} text-right`}>{formatPrice(p.pricePaise)}</td>
                    <td className={`${td} text-right`}>{p.productType === "OWN" ? ((p.stock ?? 0) === 0 ? <Badge tone="red">Out of stock</Badge> : p.stock) : "—"}</td>
                    <td className={td}><Badge tone={p.status === "PUBLISHED" ? "green" : "slate"}>{p.status === "PUBLISHED" ? "Live" : "Draft"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
