"use client";

import { Fragment, useState } from "react";
import { formatPrice } from "@/lib/api";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, btn, inputCls, td, th } from "@/components/admin/ui";
import { useBrand } from "@/components/BrandProvider";
import { Select } from "@/components/Select";

interface Order {
  id: string; status: string; totalPaise: number; createdAt: string; paymentMethod: string; shippingName: string; cancelReason?: string | null;
  courierName: string | null; trackingNumber: string | null; trackingUrl: string | null; advancePaise: number;
  subtotalPaise: number; discountPaise: number; rewardDiscountPaise: number; shippingPaise: number; couponCode: string | null; gifts: string[]; refundId: string | null; whatsappOptIn?: boolean; refundedPaise: number; paymentId: string | null;
  shippingAddr: { name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string };
  user: { name: string; email: string | null; phone: string | null; guestCheckout?: boolean };
  items: { id: string; quantity: number; pricePaise: number; costPaise: number | null; optionLabel: string | null; product: { name: string } }[];
}

const STATUSES = ["PENDING_PAYMENT", "PLACED", "PAID", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
const LABEL = (s: string) => (s === "PENDING_PAYMENT" ? "Awaiting payment" : s.charAt(0) + s.slice(1).toLowerCase());
const TONE: Record<string, "green" | "amber" | "slate" | "red"> = { PLACED: "amber", PAID: "green", SHIPPED: "green", DELIVERED: "green", CANCELLED: "red", REFUNDED: "red", PENDING_PAYMENT: "slate" };
// Only suggestions: any courier name can be typed.
const COURIERS = ["Delhivery", "Blue Dart", "DTDC", "India Post", "Ecom Express", "Xpressbees", "Shadowfax", "Self delivery"];

// Who is carrying the parcel and how the customer can follow it. Shown when marking an order shipped, and afterwards to correct the details.
function TrackingPanel({ order, shipping, done, cancel }: { order: Order; shipping: boolean; done: (message: string) => void; cancel: () => void }) {
  const call = useAdminApi();
  const [courier, setCourier] = useState(order.courierName ?? "");
  const [number, setNumber] = useState(order.trackingNumber ?? "");
  const [url, setUrl] = useState(order.trackingUrl ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setError("");
    const body = { courierName: courier.trim() || undefined, trackingNumber: number.trim() || undefined, trackingUrl: url.trim() || undefined };
    try {
      if (shipping) await call(`/admin/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "SHIPPED", ...body }) });
      else await call(`/admin/orders/${order.id}/tracking`, { method: "PATCH", body: JSON.stringify(body) });
      done(shipping ? "Order marked as shipped" : "Tracking saved");
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <div className="mt-5 space-y-3 rounded-xl border border-line bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{shipping ? "Shipping details" : "Courier and tracking"}</h3>
      {shipping && <p className="text-xs text-muted">The customer is emailed (and messaged, if they chose updates) with these details. All optional, but they save support calls.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <label className="block text-xs font-medium text-muted">Courier
        <input value={courier} maxLength={60} onChange={(e) => setCourier(e.target.value)} placeholder="Delhivery" className={`${inputCls} mt-1 text-ink`} />
      </label>
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        {COURIERS.map((c) => <button key={c} type="button" onClick={() => setCourier(c)} className="rounded-full border border-line px-2.5 py-1 font-medium text-ink-3 hover:border-ink/40">{c}</button>)}
      </p>
      <label className="block text-xs font-medium text-muted">Tracking number
        <input value={number} maxLength={60} onChange={(e) => setNumber(e.target.value)} className={`${inputCls} mt-1 font-mono text-ink`} />
      </label>
      <label className="block text-xs font-medium text-muted">Tracking link
        <input type="url" value={url} maxLength={500} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (the courier's tracking page for this parcel)" className={`${inputCls} mt-1 text-ink`} />
      </label>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={save} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-600 disabled:opacity-60">{busy ? "Saving…" : shipping ? "Mark as shipped" : "Save tracking"}</button>
        {shipping && <button type="button" onClick={cancel} className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:border-ink/40">Cancel</button>}
      </div>
    </div>
  );
}

// Marks the chosen orders shipped with one courier. A tracking number can be typed for each parcel, or pasted as a list from the courier (order number, then tracking number, one per line).
function BulkShipPanel({ orders: chosen, done, cancel }: { orders: { id: string; shippingName: string }[]; done: (message: string) => void; cancel: () => void }) {
  const call = useAdminApi();
  const ids = chosen.map((o) => o.id);
  const [courier, setCourier] = useState("");
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [template, setTemplate] = useState("");
  const [paste, setPaste] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refOf = (id: string) => id.slice(-8).toUpperCase();

  // "AB12CD34 1234567890" fills that order's number; lines that match no chosen order are ignored.
  function fillFromList() {
    const next = { ...numbers };
    let hit = 0;
    for (const line of paste.split(/\r?\n/)) {
      const [ref, number] = line.trim().split(/[\s,;\t]+/);
      const order = chosen.find((o) => refOf(o.id) === ref?.replace(/^#/, "").toUpperCase());
      if (order && number) { next[order.id] = number; hit++; }
    }
    setNumbers(next);
    setError(hit ? "" : "No line matched the chosen orders. Each line needs the order number, then the tracking number.");
  }

  async function ship() {
    setBusy(true); setError("");
    const trackingNumbers = ids.filter((id) => numbers[id]?.trim()).map((id) => ({ id, trackingNumber: numbers[id].trim() }));
    try {
      const res = await call<{ shipped: string[]; skipped: { id: string; reason: string }[] }>("/admin/orders/bulk-ship", { method: "POST", body: JSON.stringify({ ids, courierName: courier.trim() || undefined, trackingNumbers: trackingNumbers.length ? trackingNumbers : undefined, trackingUrlTemplate: template.trim() || undefined }) });
      const left = res.skipped.length ? ` ${res.skipped.length} left out: ${res.skipped.map((s) => `#${s.id.slice(-8).toUpperCase()} (${s.reason.toLowerCase()})`).join(", ")}.` : "";
      done(`${res.shipped.length} ${res.shipped.length === 1 ? "order" : "orders"} marked as shipped.${left}`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <div className="mb-4 space-y-3 rounded-xl border border-line bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Mark {ids.length} {ids.length === 1 ? "order" : "orders"} as shipped</h3>
      <p className="text-xs text-muted">Only orders that are placed or paid are shipped; the others are left out and listed afterwards. Each customer is told, as when shipping one order.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <label className="block text-xs font-medium text-muted">Courier for all of them
        <input value={courier} maxLength={60} onChange={(e) => setCourier(e.target.value)} placeholder="Delhivery" className={`${inputCls} mt-1 text-ink`} />
      </label>
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        {COURIERS.map((c) => <button key={c} type="button" onClick={() => setCourier(c)} className="rounded-full border border-line px-2.5 py-1 font-medium text-ink-3 hover:border-ink/40">{c}</button>)}
      </p>
      <div className="space-y-2 border-t border-line pt-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Tracking numbers <span className="font-normal normal-case">optional</span></h4>
        <ul className="space-y-1.5">
          {chosen.map((o) => (
            <li key={o.id} className="flex items-center gap-3 text-sm">
              <span className="w-44 shrink-0 truncate"><span className="font-mono text-xs font-semibold">#{refOf(o.id)}</span> {o.shippingName}</span>
              <input value={numbers[o.id] ?? ""} maxLength={60} aria-label={`Tracking number for ${refOf(o.id)}`} onChange={(e) => setNumbers({ ...numbers, [o.id]: e.target.value })} className={`${inputCls} font-mono text-ink`} />
            </li>
          ))}
        </ul>
        <details className="text-xs text-muted">
          <summary className="cursor-pointer font-medium text-ink-3">Paste a list from the courier</summary>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} aria-label="Tracking list" placeholder={"AB12CD34 1234567890\nEF56GH78 1234567891"} className={`${inputCls} mt-2 font-mono text-ink`} />
          <button type="button" onClick={fillFromList} className="mt-2 rounded-xl border border-line px-3 py-1.5 font-medium text-ink hover:border-ink/40">Fill the numbers</button>
        </details>
        <label className="block text-xs font-medium text-muted">Tracking link for the customer <span className="font-normal">(use {"{number}"} where the tracking number goes)</span>
          <input type="url" value={template} maxLength={500} onChange={(e) => setTemplate(e.target.value)} placeholder="https://courier.example/track/{number}" className={`${inputCls} mt-1 text-ink`} />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={ship} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-600 disabled:opacity-60">{busy ? "Shipping…" : "Mark as shipped"}</button>
        <button type="button" onClick={cancel} className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:border-ink/40">Cancel</button>
      </div>
    </div>
  );
}

const MAX_SELECTED = 50;

export default function OrdersAdminPage() {
  const brand = useBrand();
  const call = useAdminApi();
  const me = useAuth().user;
  // Moving an order along and cancelling or refunding it are separate permissions.
  const canProcess = can(me, "orders.process");
  const canCancel = can(me, "orders.cancel");
  const allowedStatus = (s: string) => (s === "CANCELLED" || s === "REFUNDED" ? canCancel : canProcess);
  const [filter, setFilter] = useState("");
  const orders = useAdminQuery<Order[]>(`/admin/orders${filter ? `?status=${filter}` : ""}`);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // The order being marked shipped, while its courier details are typed.
  const [shipping, setShipping] = useState<string | null>(null);
  // Orders ticked for printing or shipping together.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);
  const rows = orders.data ?? [];
  const chosen = [...selected].filter((id) => rows.some((o) => o.id === id));
  const printHref = (kind: "labels" | "slips") => `/admin/print?kind=${kind}&ids=${chosen.join(",")}`;

  function toggle(id: string, on: boolean) {
    if (on && chosen.length >= MAX_SELECTED) { setError(`Choose up to ${MAX_SELECTED} orders at a time.`); return; }
    const next = new Set(chosen);
    if (on) next.add(id); else next.delete(id);
    setSelected(next);
  }
  const selectReady = () => setSelected(new Set(rows.filter((o) => o.status === "PLACED" || o.status === "PAID").slice(0, MAX_SELECTED).map((o) => o.id)));

  async function setStatus(o: Order, status: string) {
    if (status === "SHIPPED" && o.status !== "SHIPPED") { setOpen(o.id); setShipping(o.id); return; }
    if ((status === "CANCELLED" || status === "REFUNDED") && !confirm(`Mark order as ${status.toLowerCase()}? Stock will be returned and this cannot be undone.${o.paymentMethod === "ONLINE" && o.paymentId ? ` The customer's payment of ${formatPrice(o.totalPaise)} will be refunded automatically through Razorpay.` : ""}`)) return;
    setError(""); setNotice("");
    try {
      await call(`/admin/orders/${o.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setNotice(`Order updated to ${status.toLowerCase()}`);
      orders.reload();
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <>
      <PageHeader
        title="Orders"
        description={`Orders placed on ${brand}. Cancelling or refunding returns stock to inventory.`}
        actions={
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{LABEL(s)}</option>)}
          </Select>
        }
      />
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}

      {rows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <button type="button" className={btn.secondary + " !px-3 !py-1.5"} onClick={selectReady}>Select orders to pack</button>
          {chosen.length > 0 && (
            <>
              <span className="font-medium">{chosen.length} selected</span>
              <a href={printHref("labels")} target="_blank" rel="noreferrer" className={btn.secondary + " !px-3 !py-1.5"}>Print shipping labels</a>
              <a href={printHref("slips")} target="_blank" rel="noreferrer" className={btn.secondary + " !px-3 !py-1.5"}>Print packing slips</a>
              {canProcess && <button type="button" className={btn.primary + " !px-3 !py-1.5"} onClick={() => setBulk(true)}>Mark as shipped…</button>}
              <button type="button" className="text-muted hover:underline" onClick={() => { setSelected(new Set()); setBulk(false); }}>Clear</button>
            </>
          )}
        </div>
      )}
      {bulk && chosen.length > 0 && <BulkShipPanel orders={rows.filter((o) => chosen.includes(o.id))} cancel={() => setBulk(false)} done={(m) => { setBulk(false); setSelected(new Set()); setNotice(m); orders.reload(); }} />}

      <Card padded={false}>
        {orders.loading ? <Skeleton /> : (orders.data ?? []).length === 0 ? <Empty title="No orders yet">Orders appear here when customers check out.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas/60"><th className={`${th} w-10`}><span className="sr-only">Select</span></th><th className={th}>Order</th><th className={th}>Customer</th><th className={th}>Date</th><th className={`${th} text-right`}>Total</th><th className={th}>Status</th></tr></thead>
              <tbody className="divide-y divide-line">
                {orders.data!.map((o) => {
                  const final = o.status === "CANCELLED" || o.status === "REFUNDED";
                  return (
                    <Fragment key={o.id}>
                      <tr className="hover:bg-canvas/60">
                        <td className={td}><input type="checkbox" className="h-4 w-4 accent-brand-600" aria-label={`Select order ${o.id.slice(-8)}`} checked={selected.has(o.id)} onChange={(e) => toggle(o.id, e.target.checked)} /></td>
                        <td className={td}><button onClick={() => setOpen(open === o.id ? null : o.id)} className="py-1.5 font-mono text-xs font-semibold text-brand-700 hover:underline" aria-expanded={open === o.id}>#{o.id.slice(-8).toUpperCase()}</button></td>
                        <td className={td}><p className="font-medium">{o.user.name}{o.user.guestCheckout && <span className="ml-2 align-middle"><Badge tone="slate">Guest</Badge></span>}</p><p className="text-xs text-muted">{o.user.email ?? o.user.phone}</p></td>
                        <td className={td}>{new Date(o.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                        <td className={`${td} text-right font-semibold`}>{formatPrice(o.totalPaise)}</td>
                        <td className={td}>
                          {final || (!canProcess && !canCancel) ? <Badge tone={TONE[o.status]}>{LABEL(o.status).toLowerCase()}</Badge> : (
                            <Select value={o.status} onChange={(e) => setStatus(o, e.target.value)} className={`${inputCls} !w-auto py-1.5`} aria-label={`Status for order ${o.id.slice(-8)}`}>
                              {STATUSES.filter((s) => s === o.status || allowedStatus(s)).map((s) => <option key={s} value={s}>{LABEL(s)}</option>)}
                            </Select>
                          )}
                        </td>
                      </tr>
                      {open === o.id && (
                        <tr><td colSpan={6} className="bg-canvas/60 px-5 py-4">
                          <div className="grid gap-6 md:grid-cols-2">
                            <div>
                              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Items</h3>
                              <ul className="space-y-1 text-sm">{o.items.map((i) => <li key={i.id} className="flex justify-between"><span>{i.product.name}{i.optionLabel ? ` (${i.optionLabel})` : ""} × {i.quantity}</span><span>{formatPrice(i.pricePaise * i.quantity)}</span></li>)}</ul>
                              <dl className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-muted">
                                <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(o.subtotalPaise)}</dd></div>
                                {o.rewardDiscountPaise > 0 && <div className="flex justify-between"><dt>Order reward</dt><dd>-{formatPrice(o.rewardDiscountPaise)}</dd></div>}
                                {o.discountPaise - o.rewardDiscountPaise > 0 && <div className="flex justify-between"><dt>Discount{o.couponCode ? ` (${o.couponCode})` : ""}</dt><dd>-{formatPrice(o.discountPaise - o.rewardDiscountPaise)}</dd></div>}
                                <div className="flex justify-between"><dt>Delivery</dt><dd>{o.shippingPaise > 0 ? formatPrice(o.shippingPaise) : "Free"}</dd></div>
                                <div className="flex justify-between font-semibold text-ink"><dt>Total</dt><dd>{formatPrice(o.totalPaise)}</dd></div>
                              </dl>
                              {o.status === "CANCELLED" && o.cancelReason && <p className="mt-2 text-xs text-muted">Cancellation reason: {o.cancelReason}</p>}
                              {o.gifts.length > 0 && <p className="mt-2 text-xs font-semibold text-brand-800">Pack with this order: {o.gifts.join(", ")}</p>}
                              <p className="mt-2 text-xs text-muted">Payment: {o.paymentMethod === "COD" ? "Pay on delivery" : o.advancePaise > 0 ? "Part payment (online advance)" : "Online (Razorpay)"}{o.status !== "PENDING_PAYMENT" && o.status !== "CANCELLED" && <> · <a href={`/invoice/${o.id}`} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">Open invoice</a></>}</p>
                              {o.advancePaise > 0 && <p className="mt-1 text-xs font-semibold text-amber-800">{o.status === "PENDING_PAYMENT" ? `Waiting for the ${formatPrice(o.advancePaise)} advance.` : `${formatPrice(o.advancePaise)} paid online. ${o.status === "CANCELLED" || o.status === "REFUNDED" ? "" : o.status === "DELIVERED" ? `The ${formatPrice(o.totalPaise - o.advancePaise)} balance was due on delivery.` : `Collect ${formatPrice(o.totalPaise - o.advancePaise)} from the customer on delivery.`}`}</p>}
                              {o.whatsappOptIn && <p className="mt-1 text-xs text-muted">WhatsApp updates on for {o.shippingAddr.phone}</p>}
                              {o.refundedPaise > 0 && <p className="mt-1 text-xs font-medium text-brand-800">Refunded {formatPrice(o.refundedPaise)} through Razorpay{o.refundId ? ` (${o.refundId})` : ""}</p>}
                            </div>
                            <div>
                              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Ship to</h3>
                              <address className="text-sm not-italic leading-relaxed">
                                {o.shippingAddr.name}<br />{o.shippingAddr.line1}{o.shippingAddr.line2 ? `, ${o.shippingAddr.line2}` : ""}<br />
                                {o.shippingAddr.city}, {o.shippingAddr.state} {o.shippingAddr.pincode}<br />Phone: {o.shippingAddr.phone}
                              </address>
                              {canProcess && (shipping === o.id || o.status === "SHIPPED" || o.status === "DELIVERED") && (
                                <TrackingPanel key={`${o.id}-${o.courierName}-${o.trackingNumber}-${o.trackingUrl}`} order={o} shipping={shipping === o.id} cancel={() => setShipping(null)} done={(m) => { setShipping(null); setNotice(m); orders.reload(); }} />
                              )}
                            </div>
                          </div>
                        </td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
