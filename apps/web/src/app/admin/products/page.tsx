"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatPrice, imgSrc } from "@/lib/api";
import { productToDto, useAdminApi, useAdminQuery, type AdminCategory, type AdminProduct } from "@/lib/admin";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, btn, inputCls, td, th } from "@/components/admin/ui";
import { BulkEditPanel } from "@/components/admin/BulkEditPanel";
import { StaffProducts } from "@/components/admin/StaffProducts";
import { useAuth } from "@/lib/auth";
import { useLowStockThreshold } from "@/lib/attention";
import { ProductImportPanel } from "@/components/admin/ProductImportPanel";
import { API_URL } from "@/lib/api";
import { useBrand } from "@/components/BrandProvider";

type SortField = "updated" | "created" | "name" | "price" | "stock";

const SORT_LABELS: Record<SortField, string> = { updated: "Recently updated", created: "Date added", name: "Name", price: "Price", stock: "Stock" };

function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// Prices are typed in rupees; the API works in paise.
const toPaise = (rupees: string) => {
  const n = Number(rupees);
  return rupees.trim() === "" || !Number.isFinite(n) || n < 0 ? undefined : Math.round(n * 100);
};

// Staff get a read-only list; the full page with editing is for admins.
export default function ProductsPage() {
  const { user } = useAuth();
  return user?.role === "STAFF" ? <StaffProducts /> : <ProductsAdminPage />;
}

function ProductsAdminPage() {
  const brand = useBrand();
  const call = useAdminApi();
  const threshold = useLowStockThreshold();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [stock, setStock] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<SortField>("updated");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Typing in the search or price boxes waits a moment before asking the server.
  const typed = useDebounced({ q, minPrice, maxPrice });
  const path = useMemo(() => {
    const p = new URLSearchParams({ sort, dir });
    if (typed.q.trim()) p.set("q", typed.q.trim());
    if (type) p.set("type", type);
    if (status) p.set("status", status);
    if (stock) p.set("stock", stock);
    const min = toPaise(typed.minPrice), max = toPaise(typed.maxPrice);
    if (min !== undefined) p.set("minPricePaise", String(min));
    if (max !== undefined) p.set("maxPricePaise", String(max));
    return `/admin/products?${p}`;
  }, [typed, type, status, stock, sort, dir]);

  const products = useAdminQuery<AdminProduct[]>(path);
  const categories = useAdminQuery<AdminCategory[]>("/admin/categories");

  const catName = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c.name])), [categories.data]);
  const rows = products.data ?? [];
  const filtered = !!(q || type || status || stock || minPrice || maxPrice);
  const priceRangeInvalid = toPaise(minPrice) !== undefined && toPaise(maxPrice) !== undefined && toPaise(minPrice)! > toPaise(maxPrice)!;

  // The selection belongs to one set of filters: changing a filter (not the sort order) starts a fresh selection,
  // so "edit selected" can only ever touch products that are in the list on screen.
  const filterKey = [typed.q.trim(), type, status, stock, typed.minPrice, typed.maxPrice].join("|");
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({ key: filterKey, ids: [] });
  // Dropping the old selection as soon as the filters change, so returning to an earlier filter doesn't bring it back.
  if (selection.key !== filterKey) setSelection({ key: filterKey, ids: [] });
  const [bulkOpen, setBulkOpen] = useState(false);
  const selectedIds = useMemo(() => new Set(selection.key === filterKey ? selection.ids : []), [selection, filterKey]);
  const selectedRows = rows.filter((r) => selectedIds.has(r.id));
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;
  const setSelected = (ids: string[]) => setSelection({ key: filterKey, ids });
  const toggleRow = (id: string) => setSelected(selectedIds.has(id) ? [...selectedIds].filter((x) => x !== id) : [...selectedIds, id]);
  const toggleAll = () => setSelected(allSelected ? [] : rows.map((r) => r.id));
  const selectAllBox = (id: string) => (
    <input
      id={id} type="checkbox" aria-label="Select all products" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-emerald-600"
      ref={(el) => { if (el) el.indeterminate = selectedRows.length > 0 && !allSelected; }}
    />
  );

  function clearFilters() {
    setQ(""); setType(""); setStatus(""); setStock(""); setMinPrice(""); setMaxPrice("");
  }
  // Clicking the active column flips the direction; a new column starts ascending (text) or as shown.
  function sortBy(field: SortField) {
    if (field === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(field); setDir(field === "name" || field === "price" || field === "stock" ? "asc" : "desc"); }
  }
  const sortHeader = (field: SortField, label: string) => (
    <button type="button" onClick={() => sortBy(field)} className="inline-flex items-center gap-1 py-1.5 font-semibold uppercase tracking-wider hover:text-ink">
      {label}<span aria-hidden className={sort === field ? "text-brand-700" : "text-line"}>{sort === field ? (dir === "asc" ? "▲" : "▼") : "⇅"}</span>
    </button>
  );
  const ariaSort = (field: SortField) => (sort === field ? (dir === "asc" ? "ascending" : "descending") : "none");

  async function exportCsv() {
    setError(""); setExporting(true);
    try {
      const res = await fetch(`${API_URL}/admin/products/export`, { credentials: "include" });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError((e as Error).message); } finally { setExporting(false); }
  }

  async function act(fn: () => Promise<unknown>, message: string) {
    setError(""); setNotice("");
    try { await fn(); setNotice(message); products.reload(); } catch (e) { setError((e as Error).message); }
  }
  const update = (p: AdminProduct, over: Partial<AdminProduct>, message: string) =>
    act(() => call(`/admin/products/${p.id}`, { method: "PUT", body: JSON.stringify(productToDto(p, over)) }), message);

  return (
    <>
      <PageHeader title="Products" description={`Manage ${brand}-owned and affiliate products.`} actions={<><button type="button" className={btn.secondary} disabled={exporting} onClick={exportCsv}>{exporting ? "Preparing…" : "Export CSV"}</button><button type="button" className={btn.secondary} onClick={() => setImportOpen((o) => !o)}>Import CSV</button><Link href="/admin/products/new" className={btn.primary}>+ Add product</Link></>} />
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}

      {importOpen && (
        <div className="mb-6">
          <ProductImportPanel onClose={() => setImportOpen(false)} onDone={(message) => { setError(""); setNotice(message); products.reload(); categories.reload(); }} />
        </div>
      )}

      {bulkOpen && selectedRows.length > 0 && (
        <div className="mb-6">
          <BulkEditPanel
            products={selectedRows}
            onClose={() => setBulkOpen(false)}
            onDone={(message) => { setBulkOpen(false); setSelected([]); setError(""); setNotice(message); products.reload(); }}
          />
        </div>
      )}

      <Card padded={false}>
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex flex-wrap gap-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, brand or SKU" className={`${inputCls} max-w-xs`} aria-label="Search products" />
            <select value={type} onChange={(e) => { setType(e.target.value); if (e.target.value === "AFFILIATE") setStock(""); }} className={`${inputCls} !w-auto`} aria-label="Filter by type">
              <option value="">All types</option><option value="OWN">Sold by {brand}</option><option value="AFFILIATE">Affiliate</option>
            </select>
            <select value={stock} onChange={(e) => setStock(e.target.value)} disabled={type === "AFFILIATE"} title={type === "AFFILIATE" ? "Stock is only tracked for DMG products" : undefined} className={`${inputCls} !w-auto disabled:opacity-50`} aria-label="Filter by stock">
              <option value="">Any stock</option><option value="in">In stock</option><option value="low">Low stock (1–{threshold})</option><option value="out">Out of stock</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Filter by status">
              <option value="">All statuses</option><option value="PUBLISHED">Published</option><option value="DRAFT">Draft</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2" role="group" aria-label="Price range in rupees">
              <span className="text-xs font-medium text-muted">Price ₹</span>
              <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} type="number" min={0} inputMode="decimal" placeholder="Min" aria-label="Minimum price" className={`${inputCls} !w-24`} />
              <span className="text-muted">to</span>
              <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} type="number" min={0} inputMode="decimal" placeholder="Max" aria-label="Maximum price" className={`${inputCls} !w-24`} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted" htmlFor="sort-field">Sort by</label>
              <select id="sort-field" value={sort} onChange={(e) => sortBy(e.target.value as SortField)} className={`${inputCls} !w-auto`}>
                {(Object.keys(SORT_LABELS) as SortField[]).map((f) => <option key={f} value={f}>{SORT_LABELS[f]}</option>)}
              </select>
              <button type="button" onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))} className={btn.secondary + " !py-2"} aria-label={`Order: ${dir === "asc" ? "ascending" : "descending"}. Click to reverse.`}>
                {dir === "asc" ? "▲ Ascending" : "▼ Descending"}
              </button>
            </div>
            {filtered && <button type="button" onClick={clearFilters} className="text-sm font-medium text-brand-700 hover:underline">Clear filters</button>}
            <span className="ml-auto text-xs text-muted" aria-live="polite">{products.loading ? "Loading…" : `${rows.length} ${rows.length === 1 ? "product" : "products"}`}</span>
          </div>
          {priceRangeInvalid && <p role="alert" className="text-xs text-red-600">The minimum price is higher than the maximum, so nothing can match.</p>}
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
              <label htmlFor="select-all-products" className="flex items-center gap-2 text-sm">
                {selectAllBox("select-all-products")}
                Select all {rows.length} {filtered ? "matching " : ""}{rows.length === 1 ? "product" : "products"}
              </label>
              {selectedRows.length > 0 && (
                <>
                  <span className="text-sm font-medium" aria-live="polite">{selectedRows.length} selected</span>
                  <button type="button" onClick={() => setBulkOpen(true)} className={btn.primary + " !py-1.5"}>Edit selected</button>
                  <button type="button" onClick={() => { setSelected([]); setBulkOpen(false); }} className="text-sm font-medium text-brand-700 hover:underline">Clear selection</button>
                </>
              )}
            </div>
          )}
        </div>

        {products.loading ? <Skeleton /> : rows.length === 0 ? (
          <Empty title="No products match">Try adjusting your filters or <Link href="/admin/products/new" className="text-brand-700 underline">add a product</Link>.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas/60">
                <th className={`${th} w-10`}><span className="sr-only">Select</span>{selectAllBox("select-all-header")}</th>
                <th className={th} aria-sort={ariaSort("name")}>{sortHeader("name", "Product")}</th><th className={th}>Type</th><th className={th} aria-sort={ariaSort("price")}>{sortHeader("price", "Price")}</th><th className={th} aria-sort={ariaSort("stock")}>{sortHeader("stock", "Stock")}</th><th className={th}>Status</th><th className={th}>Featured</th><th className={`${th} text-right`}>Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => (
                  <tr key={p.id} className={`hover:bg-canvas/60 ${selectedIds.has(p.id) ? "bg-brand-50/50" : ""}`}>
                    <td className={td}><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleRow(p.id)} aria-label={`Select ${p.name}`} className="h-4 w-4 accent-emerald-600" /></td>
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-canvas ring-1 ring-line">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.images[0] && <img src={imgSrc(p.images[0].url)} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <Link href={`/admin/products/${p.id}`} className="block truncate font-medium hover:text-brand-700">{p.name}</Link>
                          <p className="truncate text-xs text-muted">{catName.get(p.categoryId) ?? "—"}{p.sku ? ` · ${p.sku}` : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className={td}>{p.productType === "OWN" ? <Badge tone="green">{brand}</Badge> : <Badge tone="amber">{p.platform}</Badge>}</td>
                    <td className={td}>
                      <span className="font-medium">{formatPrice(p.pricePaise)}</span>
                      {p.mrpPaise ? <span className="ml-1.5 text-xs text-muted line-through">{formatPrice(p.mrpPaise)}</span> : null}
                    </td>
                    <td className={td}>{p.productType === "OWN" ? <span className={(p.stock ?? 0) <= 5 ? "font-semibold text-red-600" : ""}>{p.stock}</span> : <span className="text-muted">—</span>}</td>
                    <td className={td}>
                      <button onClick={() => update(p, { status: p.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }, p.status === "PUBLISHED" ? "Product unpublished" : "Product published")} title="Click to toggle" className="rounded-full">
                        <Badge tone={p.status === "PUBLISHED" ? "green" : "slate"}>{p.status === "PUBLISHED" ? "● Published" : "○ Draft"}</Badge>
                      </button>
                    </td>
                    <td className={td}>
                      <button onClick={() => update(p, { featured: !p.featured }, p.featured ? "Removed from featured" : "Marked as featured")} aria-label={p.featured ? "Remove from featured" : "Mark as featured"} className={`p-1 text-xl leading-none ${p.featured ? "text-gold" : "text-line hover:text-gold/60"}`}>★</button>
                    </td>
                    <td className={`${td} text-right`}>
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/products/${p.id}`} className={btn.secondary + " !px-3 !py-1.5"}>Edit</Link>
                        <button className={btn.danger} onClick={() => confirm(`Delete “${p.name}”? This cannot be undone.`) && act(() => call(`/admin/products/${p.id}`, { method: "DELETE" }), "Product deleted")}>Delete</button>
                      </div>
                    </td>
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
