"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { API_URL, formatDeliveryDate, imgSized, type Product } from "@/lib/api";
import { Money } from "@/lib/currency";
import { MAX_COMPARE, useCompare } from "@/lib/compare";
import { AddToCartButton } from "./AddToCartButton";
import { discountPercent, ImageFallback, SellerBadge } from "./ProductCard";
import { Stars } from "./Stars";

interface Row { label: string; cells: ReactNode[]; values: string[] }

export function CompareView() {
  const { ids, remove, clear } = useCompare();
  const [loaded, setLoaded] = useState<{ key: string; items: Product[] } | null>(null);
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const key = ids.join(",");

  useEffect(() => {
    if (!key) return;
    let stale = false;
    fetch(`${API_URL}/products/by-ids?ids=${encodeURIComponent(key)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((items: Product[]) => { if (!stale) setLoaded({ key, items }); })
      .catch(() => { if (!stale) setLoaded({ key, items: [] }); });
    return () => { stale = true; };
  }, [key]);

  // Products that were unpublished since they were picked drop out.
  const items = useMemo(() => (loaded?.key === key ? loaded.items.filter((p) => ids.includes(p.id)) : []), [loaded, key, ids]);

  const rows = useMemo<Row[]>(() => {
    if (items.length === 0) return [];
    const cheapest = Math.min(...items.map((p) => p.pricePaise));
    const text = (label: string, f: (p: Product) => string | null | undefined): Row => {
      const values = items.map((p) => f(p) ?? "");
      return { label, values, cells: values.map((v, i) => <span key={i}>{v || <span className="text-muted">Not listed</span>}</span>) };
    };
    const base: Row[] = [
      {
        label: "Price",
        values: items.map((p) => String(p.pricePaise)),
        cells: items.map((p) => (
          <span key={p.id}>
            <strong className={`font-display text-lg ${p.pricePaise === cheapest && items.length > 1 ? "text-brand-700" : ""}`}><Money paise={p.pricePaise} /></strong>
            {discountPercent(p) > 0 && <span className="ml-2 text-xs text-muted line-through"><Money paise={p.mrpPaise!} /></span>}
            {p.pricePaise === cheapest && items.length > 1 && <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-800">Lowest</span>}
          </span>
        )),
      },
      {
        label: "Rating",
        values: items.map((p) => (p.ratingAvg === null ? "" : String(p.ratingAvg))),
        cells: items.map((p) => (p.ratingAvg !== null && p.ratingCount > 0 ? <span key={p.id} className="flex items-center gap-1.5"><Stars value={p.ratingAvg} /> {p.ratingAvg} ({p.ratingCount})</span> : <span key={p.id} className="text-muted">No reviews yet</span>)),
      },
      text("Brand", (p) => p.brand),
      { label: "Sold by", values: items.map((p) => p.sellerName || p.platform || ""), cells: items.map((p) => <SellerBadge key={p.id} product={p} />) },
      text("Availability", (p) => (p.productType === "AFFILIATE" ? `Available on ${p.platform}` : p.inStock === false ? "Out of stock" : "In stock")),
      text("Delivery", (p) => (p.productType === "AFFILIATE" ? "Handled by the partner" : p.deliveryBy ? `${p.freeDelivery ? "Free, " : ""}by ${formatDeliveryDate(p.deliveryBy)}` : p.deliveryInfo)),
      text("Returns", (p) => p.returnPolicy),
    ];
    const specKeys = [...new Set(items.flatMap((p) => Object.keys(p.specifications ?? {})))];
    const specs = specKeys.map((k) => text(k, (p) => p.specifications?.[k]));
    const highlights: Row = {
      label: "Highlights",
      values: items.map((p) => p.highlights.join("|")),
      cells: items.map((p) => (p.highlights.length ? <ul key={p.id} className="list-disc space-y-1 pl-4">{p.highlights.map((h) => <li key={h}>{h}</li>)}</ul> : <span key={p.id} className="text-muted">Not listed</span>)),
    };
    return [...base, ...specs, highlights];
  }, [items]);

  const shown = differencesOnly ? rows.filter((r) => new Set(r.values).size > 1) : rows;

  if (ids.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Compare products</h1>
        <p className="text-muted">Pick two to {MAX_COMPARE} products to see them side by side. Use the compare button on any product. <Link href="/products" className="text-brand-700 underline">Browse products</Link></p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold">Compare products</h1>
        <div className="flex items-center gap-4 text-sm">
          {items.length > 1 && (
            <label className="flex items-center gap-2"><input type="checkbox" checked={differencesOnly} onChange={(e) => setDifferencesOnly(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Show only differences</label>
          )}
          <button type="button" onClick={clear} className="font-semibold text-red-600 hover:underline">Clear all</button>
        </div>
      </div>

      {loaded?.key !== key ? <p className="text-sm text-muted">Loading…</p> : items.length === 0 ? (
        <p className="text-muted">Those products are no longer available. <Link href="/products" className="text-brand-700 underline">Browse products</Link></p>
      ) : (
        <>
          {items.length === 1 && <p role="status" className="rounded-xl bg-canvas px-4 py-3 text-sm">Add at least one more product to compare. <Link href="/products" className="font-semibold text-brand-700 underline">Keep browsing</Link></p>}
          <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card" tabIndex={0} role="region" aria-label="Product comparison table">
            <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
              <caption className="sr-only">Comparison of {items.map((p) => p.name).join(", ")}</caption>
              <thead>
                <tr>
                  <td className="w-32 border-b border-line bg-canvas/60 p-3 sm:w-40" />
                  {items.map((p) => (
                    <th key={p.id} scope="col" className="border-b border-l border-line p-3 text-left align-top font-normal">
                      <div className="space-y-2">
                        <div className="aspect-square w-full max-w-40 overflow-hidden rounded-xl bg-canvas">
                          {p.images[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imgSized(p.images[0].url, 320)} alt="" className="h-full w-full object-cover" />
                          ) : <ImageFallback name={p.name} />}
                        </div>
                        <Link href={`/products/${p.slug}`} className="block font-semibold leading-snug hover:text-brand-700">{p.name}</Link>
                        <button type="button" onClick={() => remove(p.id)} className="py-1 text-xs font-semibold text-red-600 hover:underline" aria-label={`Remove ${p.name} from comparison`}>Remove</button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.label} className="align-top">
                    <th scope="row" className="border-b border-line bg-canvas/60 p-3 text-left font-semibold text-ink-3">{r.label}</th>
                    {r.cells.map((c, i) => <td key={items[i].id} className="border-b border-l border-line p-3">{c}</td>)}
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={items.length + 1} className="p-4 text-center text-muted">These products have identical details.</td></tr>}
                <tr>
                  <th scope="row" className="bg-canvas/60 p-3 text-left font-semibold text-ink-3">Buy</th>
                  {items.map((p) => (
                    <td key={p.id} className="border-l border-line p-3">
                      {p.productType === "OWN" && p.showAddToCart ? <AddToCartButton product={p} /> : <Link href={`/products/${p.slug}`} className="inline-block rounded-xl border border-ink px-4 py-2 font-semibold hover:bg-ink hover:text-white">{p.productType === "OWN" ? "View product" : "View deal"}</Link>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
