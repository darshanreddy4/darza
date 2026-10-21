"use client";

import { useState } from "react";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, btn, inputCls, td, th } from "@/components/admin/ui";
import { Select } from "@/components/Select";

interface Warehouse { id: string; name: string; code: string; address: string | null; isMain: boolean; active: boolean; units: number }
interface Levels {
  product: { id: string; name: string; sku: string | null; tracked: boolean };
  warehouses: { id: string; name: string; code: string; isMain: boolean }[];
  items: { optionId: string | null; label: string | null; total: number; byWarehouse: { warehouseId: string; quantity: number }[] }[];
}
interface Movement { id: string; createdAt: string; productId: string; productName: string; optionLabel: string | null; delta: number; balanceAfter: number; reason: string; note: string | null; orderId: string | null; actorName: string | null; warehouse: { name: string; code: string } | null }
interface Movements { total: number; page: number; pageSize: number; items: Movement[] }
interface Found { id: string; name: string; sku: string | null; productType: string }

const REASON: Record<string, string> = { SALE: "Sold", CANCELLED: "Order cancelled", RETURNED: "Returned", RECEIVED: "Received", ADJUSTMENT: "Count corrected", TRANSFER: "Moved", EDIT: "Edited", IMPORT: "Imported" };
const label = "block text-xs font-medium text-muted";

export default function StockPage() {
  const { user } = useAuth();
  const manage = can(user, "inventory.manage");
  const warehouses = useAdminQuery<Warehouse[]>("/admin/warehouses");
  const [product, setProduct] = useState<Found | null>(null);
  const [onlyThis, setOnlyThis] = useState(false);
  const [where, setWhere] = useState("");
  const [reason, setReason] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page) });
  if (where) params.set("warehouseId", where);
  if (reason) params.set("reason", reason);
  if (onlyThis && product) params.set("productId", product.id);
  const history = useAdminQuery<Movements>(`/admin/stock/movements?${params}`);
  const pages = history.data ? Math.max(1, Math.ceil(history.data.total / history.data.pageSize)) : 1;
  const changed = () => { warehouses.reload(); history.reload(); };

  return (
    <>
      <PageHeader title="Stock & warehouses" description="Where your stock is kept, and a record of every change to it. Sales, cancellations and returns are recorded automatically." />
      <WarehouseCard warehouses={warehouses.data} loading={warehouses.loading} error={warehouses.error} manage={manage} reload={changed} />
      <ProductPicker onPick={(p) => { setProduct(p); setPage(1); }} />
      {product && <ProductStock key={product.id} productId={product.id} manage={manage} changed={changed} />}

      <Card title="Stock history" description="Newest first. Pick a product above to look at just that product." className="mt-6" padded={false}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {product && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={onlyThis} onChange={(e) => { setOnlyThis(e.target.checked); setPage(1); }} />Only {product.name}</label>}
            <Select className={`${inputCls} !w-auto`} aria-label="Filter by warehouse" value={where} onChange={(e) => { setWhere(e.target.value); setPage(1); }}>
              <option value="">All warehouses</option>
              {(warehouses.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
            <Select className={`${inputCls} !w-auto`} aria-label="Filter by reason" value={reason} onChange={(e) => { setReason(e.target.value); setPage(1); }}>
              <option value="">All changes</option>
              {Object.entries(REASON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
        }>
        {history.error && !history.data && <div className="p-5"><Alert tone="error">{history.error}</Alert></div>}
        {history.loading && !history.data ? <Skeleton /> : !history.data || history.data.items.length === 0 ? <Empty title="No stock changes yet">Changes appear here as soon as stock is sold, received, corrected or moved.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas/60"><th className={th}>When</th><th className={th}>Product</th><th className={th}>Warehouse</th><th className={`${th} text-right`}>Change</th><th className={`${th} text-right`}>In stock after</th><th className={th}>What happened</th><th className={th}>By</th></tr></thead>
              <tbody className="divide-y divide-line">
                {history.data.items.map((m) => (
                  <tr key={m.id} className="hover:bg-canvas/60">
                    <td className={`${td} whitespace-nowrap text-muted`}>{new Date(m.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className={td}>{m.productName}{m.optionLabel && <span className="text-xs text-muted"> ({m.optionLabel})</span>}</td>
                    <td className={td}>{m.warehouse?.name ?? <span className="text-muted">None</span>}</td>
                    <td className={`${td} text-right font-semibold ${m.delta > 0 ? "text-green-700" : "text-red-700"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                    <td className={`${td} text-right`}>{m.balanceAfter}</td>
                    <td className={td}><Badge tone={m.delta > 0 ? "green" : "slate"}>{REASON[m.reason] ?? m.reason}</Badge>{m.orderId && <span className="ml-2 font-mono text-xs">#{m.orderId.slice(-8).toUpperCase()}</span>}{m.note && <p className="mt-0.5 text-xs text-muted">{m.note}</p>}</td>
                    <td className={`${td} text-muted`}>{m.actorName ?? "System"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {history.data && history.data.total > history.data.pageSize && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-muted">
            <p>{history.data.total} changes</p>
            <div className="flex items-center gap-2">
              <button className={btn.secondary} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {page} of {pages}</span>
              <button className={btn.secondary} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

function WarehouseCard({ warehouses, loading, error, manage, reload }: { warehouses: Warehouse[] | null; loading: boolean; error: string; manage: boolean; reload: () => void }) {
  const call = useAdminApi();
  const [form, setForm] = useState<{ id?: string; name: string; code: string; address: string } | null>(null);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(fn: () => Promise<unknown>, message: string) {
    setFailure(""); setNotice(""); setBusy(true);
    try { await fn(); setNotice(message); reload(); return true; } catch (e) { setFailure((e as Error).message); return false; } finally { setBusy(false); }
  }
  const body = (w: Pick<Warehouse, "name" | "code" | "address">, active: boolean) => JSON.stringify({ name: w.name.trim(), code: w.code.trim(), address: w.address?.trim() || undefined, active });

  async function save() {
    if (!form) return;
    const ok = await act(() => call(form.id ? `/admin/warehouses/${form.id}` : "/admin/warehouses", { method: form.id ? "PUT" : "POST", body: body(form, true) }), form.id ? "Warehouse saved" : "Warehouse added");
    if (ok) setForm(null);
  }

  return (
    <Card title="Warehouses" description="Stock that is not moved to another warehouse stays in the main one. Customers see one total across all of them."
      actions={manage ? <button className={btn.primary} onClick={() => setForm({ name: "", code: "", address: "" })}>+ Add warehouse</button> : undefined} padded={false}>
      {(error || failure) && <div className="p-5 pb-0"><Alert tone="error" onClose={() => setFailure("")}>{failure || error}</Alert></div>}
      {notice && <div className="p-5 pb-0"><Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert></div>}
      {form && (
        <div className="grid gap-3 border-b border-line p-5 sm:grid-cols-[1fr_8rem_1.5fr_auto]">
          <label className={label}>Name<input value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bengaluru warehouse" className={`${inputCls} mt-1 text-ink`} /></label>
          <label className={label}>Code<input value={form.code} maxLength={10} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="BLR" className={`${inputCls} mt-1 font-mono uppercase text-ink`} /></label>
          <label className={label}>Address <span className="font-normal">optional</span><input value={form.address} maxLength={200} onChange={(e) => setForm({ ...form, address: e.target.value })} className={`${inputCls} mt-1 text-ink`} /></label>
          <div className="flex items-end gap-2">
            <button className={btn.primary} disabled={busy || form.name.trim().length < 2 || form.code.trim().length < 2} onClick={save}>{busy ? "Saving\u2026" : "Save"}</button>
            <button className={btn.secondary} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}
      {loading && !warehouses ? <Skeleton /> : (
        <ul className="divide-y divide-line">
          {(warehouses ?? []).map((w) => (
            <li key={w.id} aria-label={`Warehouse ${w.name}`} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="font-semibold">{w.name} <span className="ml-1 font-mono text-xs font-normal text-muted">{w.code}</span> {w.isMain && <Badge tone="green">Main</Badge>} {!w.active && <Badge tone="slate">Switched off</Badge>}</p>
                {w.address && <p className="text-sm text-muted">{w.address}</p>}
              </div>
              <div className="flex items-center gap-4">
                <p className="text-right"><span className="text-xl font-bold">{w.units}</span> <span className="text-xs text-muted">units</span></p>
                {manage && (
                  <div className="flex gap-2">
                    <button className={btn.secondary + " !px-3 !py-1.5"} onClick={() => setForm({ id: w.id, name: w.name, code: w.code, address: w.address ?? "" })}>Edit</button>
                    {!w.isMain && <button className={btn.secondary + " !px-3 !py-1.5"} disabled={busy} onClick={() => act(() => call(`/admin/warehouses/${w.id}`, { method: "PUT", body: body(w, !w.active) }), w.active ? "Warehouse switched off" : "Warehouse switched on")}>{w.active ? "Switch off" : "Switch on"}</button>}
                    {!w.isMain && <button className={btn.danger} disabled={busy} onClick={() => confirm(`Delete the warehouse \u201c${w.name}\u201d?`) && act(() => call(`/admin/warehouses/${w.id}`, { method: "DELETE" }), "Warehouse deleted")}>Delete</button>}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ProductPicker({ onPick }: { onPick: (p: Found) => void }) {
  const call = useAdminApi();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [error, setError] = useState("");

  async function search() {
    setError("");
    try { setFound((await call<Found[]>(`/admin/products?q=${encodeURIComponent(q.trim())}&sort=name&dir=asc`)).filter((p) => p.productType === "OWN").slice(0, 8)); } catch (e) { setError((e as Error).message); }
  }

  return (
    <Card title="Look at one product" description="Find a product to see where its units are, and to receive, correct or move them." className="mt-6">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a product" placeholder="Product name or SKU" className={inputCls} />
        <button type="submit" className={btn.secondary}>Find</button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      {found && (found.length === 0 ? <p className="mt-3 text-sm text-muted">No product of ours matches.</p> : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {found.map((p) => <li key={p.id}><button type="button" onClick={() => { onPick(p); setFound(null); }} className="rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:border-ink/40">{p.name}{p.sku ? <span className="ml-1 font-mono text-xs text-muted">{p.sku}</span> : null}</button></li>)}
        </ul>
      ))}
    </Card>
  );
}

type Mode = "receive" | "adjust" | "transfer";

function ProductStock({ productId, manage, changed }: { productId: string; manage: boolean; changed: () => void }) {
  const call = useAdminApi();
  const levels = useAdminQuery<Levels>(`/admin/stock/levels/${productId}`);
  const [mode, setMode] = useState<Mode>("receive");
  const [option, setOption] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const data = levels.data;

  if (levels.loading && !data) return <Card className="mt-6"><Skeleton rows={2} /></Card>;
  if (!data) return <Alert tone="error">{levels.error}</Alert>;
  const main = data.warehouses.find((w) => w.isMain)?.id ?? "";
  const place = from || main;
  const target = to || data.warehouses.find((w) => !w.isMain)?.id || main;
  const optionId = data.items.length > 1 || data.items[0].optionId ? option || data.items[0].optionId || "" : "";
  const number = Number(qty);

  async function submit() {
    setError(""); setNotice(""); setBusy(true);
    const base = { productId, optionId: optionId || undefined, note: note.trim() || undefined };
    try {
      if (mode === "receive") await call("/admin/stock/receive", { method: "POST", body: JSON.stringify({ ...base, warehouseId: place, quantity: number }) });
      else if (mode === "adjust") await call("/admin/stock/adjust", { method: "POST", body: JSON.stringify({ ...base, warehouseId: place, delta: number }) });
      else await call("/admin/stock/transfer", { method: "POST", body: JSON.stringify({ ...base, fromWarehouseId: place, toWarehouseId: target, quantity: number }) });
      setNotice(mode === "receive" ? "Stock received" : mode === "adjust" ? "Count corrected" : "Stock moved");
      setQty(""); setNote("");
      levels.reload();
      changed();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const wh = (id: string) => data.warehouses.find((w) => w.id === id);
  return (
    <Card title={data.product.name} description={data.product.sku ? `SKU ${data.product.sku}` : undefined} className="mt-6" padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label={`Stock of ${data.product.name}`}>
          <thead><tr className="border-b border-line bg-canvas/60"><th className={th}>Item</th><th className={`${th} text-right`}>Total</th>{data.warehouses.map((w) => <th key={w.id} className={`${th} text-right`}>{w.name}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {data.items.map((it) => (
              <tr key={it.optionId ?? "-"}>
                <td className={td}>{it.label ?? "All units"}</td>
                <td className={`${td} text-right font-semibold`}>{it.total}</td>
                {it.byWarehouse.map((b) => <td key={b.warehouseId} className={`${td} text-right`}>{b.quantity}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {manage && data.product.tracked && (
        <div className="space-y-4 border-t border-line p-5">
          <div className="flex gap-2" role="tablist" aria-label="Change stock">
            {([["receive", "Receive stock"], ["adjust", "Correct a count"], ["transfer", "Move between warehouses"]] as [Mode, string][]).map(([m, text]) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(""); setNotice(""); }} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${mode === m ? "bg-ink text-white" : "border border-line hover:border-ink/40"}`}>{text}</button>
            ))}
          </div>
          {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
          {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.items.length > 1 || data.items[0].optionId ? (
              <label className={label}>Option
                <Select className={`${inputCls} mt-1 text-ink`} aria-label="Option" value={optionId} onChange={(e) => setOption(e.target.value)}>
                  {data.items.map((it) => <option key={it.optionId ?? "-"} value={it.optionId ?? ""}>{it.label}</option>)}
                </Select>
              </label>
            ) : null}
            <label className={label}>{mode === "transfer" ? "From" : "Warehouse"}
              <Select className={`${inputCls} mt-1 text-ink`} aria-label={mode === "transfer" ? "From warehouse" : "Warehouse"} value={place} onChange={(e) => setFrom(e.target.value)}>
                {data.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            </label>
            {mode === "transfer" && (
              <label className={label}>To
                <Select className={`${inputCls} mt-1 text-ink`} aria-label="To warehouse" value={target} onChange={(e) => setTo(e.target.value)}>
                  {data.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
              </label>
            )}
            <label className={label}>{mode === "adjust" ? "Units to add (minus to take away)" : "Units"}
              <input type="number" step="1" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Units" className={`${inputCls} mt-1 text-ink`} />
            </label>
            <label className={`${label} ${mode === "transfer" ? "sm:col-span-2" : ""}`}>{mode === "adjust" ? "Why (required)" : "Note"} {mode !== "adjust" && <span className="font-normal">optional</span>}
              <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} aria-label="Note" placeholder={mode === "receive" ? "Delivery from the supplier" : mode === "adjust" ? "Damaged in the warehouse" : "Restocking the Delhi warehouse"} className={`${inputCls} mt-1 text-ink`} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button className={btn.primary} disabled={busy || !Number.isInteger(number) || number === 0 || (mode !== "adjust" && number < 0) || (mode === "adjust" && !note.trim())} onClick={submit}>
              {busy ? "Saving\u2026" : mode === "receive" ? "Receive" : mode === "adjust" ? "Correct count" : "Move stock"}
            </button>
            {mode === "transfer" && wh(place) && wh(target) && <span className="text-xs text-muted">{wh(place)!.name} → {wh(target)!.name}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}
