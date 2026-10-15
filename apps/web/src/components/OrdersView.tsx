"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { API_URL, formatPrice } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useBrand } from "@/components/BrandProvider";
import { payForOrder, type PaymentParams } from "@/lib/razorpay";

interface Order {
  id: string; status: string; totalPaise: number; createdAt: string; paymentMethod: string;
  subtotalPaise: number; discountPaise: number; shippingPaise: number; couponCode: string | null; refundedPaise: number;
  items: { id: string; quantity: number; pricePaise: number; returnedQty: number; returnableQty: number; product: { name: string; slug: string } }[];
  returns: { id: string; status: "REQUESTED" | "APPROVED" | "REJECTED" | "REFUNDED"; reason: string; adminNote: string | null; refundPaise: number | null; payoutUpi: string | null; paidOutAt: string | null; items: { orderItemId: string; quantity: number }[] }[];
  returnableUntil: string | null;
  cancelReason: string | null;
}

const RETURN_REASONS = ["Damaged or defective", "Wrong item received", "Item not as described", "Size or fit issue", "Changed my mind", "Other"];
const CANCEL_REASONS = ["Ordered by mistake", "Found a better price", "Delivery will take too long", "Want to change the items or address", "No longer need it", "Other"];
const CANCEL_FROM = ["PENDING_PAYMENT", "PLACED", "PAID"];
const RETURN_LABEL = { REQUESTED: "Return requested", APPROVED: "Return approved", REJECTED: "Return declined", REFUNDED: "Return refunded" } as const;

function ReturnPanel({ order, onDone }: { order: Order; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const returnable = order.items.filter((i) => i.returnableQty > 0);
  const nameOf = (id: string) => order.items.find((i) => i.id === id)?.product.name ?? "Item";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const items = returnable.filter((i) => f.get(`pick-${i.id}`)).map((i) => ({ orderItemId: i.id, quantity: Number(f.get(`qty-${i.id}`) ?? 1) }));
    if (items.length === 0) return setError("Choose at least one item to return.");
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/orders/${order.id}/return`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: f.get("reason"), details: String(f.get("details") ?? "").trim() || undefined, items, upiId: order.paymentMethod === "COD" ? String(f.get("upiId") ?? "").trim() : undefined }) });
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error([d?.message].flat().filter(Boolean).join(", ") || "Could not send your request"); }
      setOpen(false); setBusy(false); onDone();
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  const until = order.returnableUntil ? new Date(order.returnableUntil).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "";
  return (
    <div className="mt-3 space-y-2">
      {order.returns.map((r) => (
        <div key={r.id} className="rounded-lg bg-canvas px-3 py-2 text-xs">
          <p className="font-semibold">{RETURN_LABEL[r.status]}{r.status === "REFUNDED" && r.refundPaise ? ` · ${formatPrice(r.refundPaise)} refunded` : ""}</p>
          <p className="mt-0.5 text-muted">{r.items.map((i) => `${i.quantity} × ${nameOf(i.orderItemId)}`).join(", ")}</p>
          <p className="text-muted">Reason: {r.reason}</p>
          {r.status === "REFUNDED" && r.payoutUpi && (r.paidOutAt
            ? <p className="text-muted">Paid to {r.payoutUpi} on {new Date(r.paidOutAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}.</p>
            : <p className="text-muted">We will pay your refund to {r.payoutUpi} and let you know when it is sent.</p>)}
          {r.adminNote && <p className="text-muted">Note from us: {r.adminNote}</p>}
        </div>
      ))}
      {order.returnableUntil && returnable.length > 0 && (!open ? (
        <button type="button" onClick={() => setOpen(true)} className="py-1 text-xs font-semibold text-brand-700 hover:underline">{order.returns.length > 0 ? "Return more items" : "Return or refund"} · until {until}</button>
      ) : (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-line p-4 text-sm" aria-label="Return request">
          <fieldset className="space-y-2">
            <legend className="font-medium">Which items are you returning?</legend>
            {returnable.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2"><input type="checkbox" name={`pick-${i.id}`} defaultChecked className="h-4 w-4 accent-emerald-600" /> {i.product.name}</label>
                {i.returnableQty > 1 ? (
                  <label className="flex items-center gap-2 text-xs text-muted">Quantity
                    <select name={`qty-${i.id}`} defaultValue={i.returnableQty} className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink">
                      {Array.from({ length: i.returnableQty }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                ) : <input type="hidden" name={`qty-${i.id}`} value="1" />}
              </div>
            ))}
          </fieldset>
          <label className="block font-medium">Why are you returning these?
            <select name="reason" required defaultValue="" className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm">
              <option value="" disabled>Select a reason</option>
              {RETURN_REASONS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          {order.paymentMethod === "COD" && (
            <label className="block font-medium">UPI ID for your refund
              <input name="upiId" required maxLength={80} autoComplete="off" placeholder="name@bank" className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm" />
              <span className="mt-1.5 block text-xs font-normal text-muted">You paid in cash, so we send your refund to this UPI ID once the items reach us.</span>
            </label>
          )}
          <label className="block font-medium">Details (optional)
            <textarea name="details" rows={3} maxLength={1000} className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm" placeholder="Tell us what went wrong" />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <div className="flex gap-3">
            <button disabled={busy} className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-3 disabled:opacity-60">{busy ? "Sending…" : "Send return request"}</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:bg-canvas">Cancel</button>
          </div>
        </form>
      ))}
    </div>
  );
}

function CancelPanel({ order, onDone }: { order: Order; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!CANCEL_FROM.includes(order.status)) return null;
  const refunds = order.paymentMethod === "ONLINE" && order.status === "PAID";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    const res = await fetch(`${API_URL}/orders/${order.id}/cancel`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: f.get("reason"), details: String(f.get("details") ?? "").trim() || undefined }) }).catch(() => null);
    if (!res?.ok) {
      const d = await res?.json().catch(() => null);
      setError([d?.message].flat().filter(Boolean).join(", ") || "Could not cancel the order. Please try again.");
      return setBusy(false);
    }
    setOpen(false); setBusy(false); onDone();
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-3 py-1 text-xs font-semibold text-red-700 hover:underline">Cancel order</button>;
  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl border border-line p-4 text-sm" aria-label="Cancel order">
      <p className="font-medium">Cancel this order?</p>
      <p className="text-xs text-muted">{refunds ? "Your payment will be refunded to your original payment method; banks usually take 5-7 business days to show it." : "The items go back on the shelf and nothing is charged."}</p>
      <label className="block font-medium">Why are you cancelling?
        <select name="reason" required defaultValue="" className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm">
          <option value="" disabled>Select a reason</option>
          {CANCEL_REASONS.map((x) => <option key={x}>{x}</option>)}
        </select>
      </label>
      <label className="block font-medium">Anything to add? (optional)
        <input name="details" maxLength={200} className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm" />
      </label>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="flex gap-3">
        <button disabled={busy} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{busy ? "Cancelling…" : "Yes, cancel order"}</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:bg-canvas">Keep order</button>
      </div>
    </form>
  );
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment", PLACED: "Order placed", PAID: "Paid", SHIPPED: "Shipped",
  DELIVERED: "Delivered", CANCELLED: "Cancelled", REFUNDED: "Refunded",
};

export function OrdersView({ placed, reason }: { placed?: "1" | "paid" | "unpaid"; reason?: string }) {
  const { user, ready } = useAuth();
  const brand = useBrand();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [version, setVersion] = useState(0);
  const [paying, setPaying] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/orders");
  }, [ready, user, router]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let stale = false;
    fetch(`${API_URL}/orders`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (!stale) setOrders(d); })
      .catch(() => { if (!stale) setOrders([]); });
    return () => { stale = true; };
  }, [userId, version]);

  const payNow = useCallback(async (orderId: string) => {
    if (!user) return;
    setPaying(orderId); setMessage(null);
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/payment`, { method: "POST", credentials: "include" });
      const params: PaymentParams & { message?: string | string[] } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error([params.message].flat().filter(Boolean).join(", ") || "Could not start the payment");
      const result = await payForOrder(params, { name: user.name, email: user.email, phone: user.phone }, brand);
      if (result.status === "paid") setMessage({ tone: "ok", text: "Payment received. Thank you!" });
      else if (result.status === "failed") setMessage({ tone: "warn", text: result.message });
    } catch (e) {
      setMessage({ tone: "warn", text: (e as Error).message });
    }
    setPaying(null);
    setVersion((v) => v + 1);
  }, [user, brand]);

  if (!ready || !user) return <p className="text-sm text-muted">Loading…</p>;

  const banner =
    message ??
    (placed === "paid" ? { tone: "ok" as const, text: "Payment received and your order is confirmed. Thank you!" }
      : placed === "unpaid" ? { tone: "warn" as const, text: `${reason ? `${reason} ` : ""}Your order is saved. Complete the payment within 30 minutes or the items are released.` }
      : placed === "1" ? { tone: "ok" as const, text: "Thank you! Your order has been placed. You'll pay on delivery." }
      : null);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My orders</h1>
      {banner && (
        <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${banner.tone === "ok" ? "border-brand-200 bg-brand-50 text-brand-800" : "border-gold/50 bg-gold-50 text-amber-900"}`}>{banner.text}</p>
      )}
      {orders === null ? <p className="text-sm text-muted">Loading orders…</p> : orders.length === 0 ? (
        <p className="text-muted">You haven&apos;t placed any orders yet. <Link href="/products?type=OWN" className="text-brand-700 underline">Start shopping</Link></p>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => (
            <li key={o.id} className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted">Placed {new Date(o.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} · #{o.id.slice(-8).toUpperCase()}</span>
                <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold ring-1 ring-line">{STATUS_LABEL[o.status] ?? o.status}</span>
              </div>
              <ul className="mt-3 divide-y divide-line text-sm">
                {o.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 py-2"><Link href={`/products/${i.product.slug}`} className="hover:text-brand-700">{i.product.name} × {i.quantity}</Link><span>{formatPrice(i.pricePaise * i.quantity)}</span></li>
                ))}
              </ul>
              {(o.discountPaise > 0 || o.shippingPaise > 0) && (
                <dl className="mt-2 space-y-1 border-t border-line pt-2 text-sm text-muted">
                  <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(o.subtotalPaise)}</dd></div>
                  {o.discountPaise > 0 && <div className="flex justify-between text-brand-700"><dt>Discount{o.couponCode ? ` (${o.couponCode})` : ""}</dt><dd>-{formatPrice(o.discountPaise)}</dd></div>}
                  <div className="flex justify-between"><dt>Delivery</dt><dd>{o.shippingPaise > 0 ? formatPrice(o.shippingPaise) : "Free"}</dd></div>
                </dl>
              )}
              {o.refundedPaise > 0 && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">{formatPrice(o.refundedPaise)} was refunded to your original payment method. Banks usually take 5-7 business days to show it.</p>}
              {o.status === "CANCELLED" && o.cancelReason && <p className="mt-2 text-xs text-muted">Cancellation reason: {o.cancelReason}</p>}
              <CancelPanel order={o} onDone={() => setVersion((v) => v + 1)} />
              <ReturnPanel order={o} onDone={() => setVersion((v) => v + 1)} />
              <div className="mt-3 flex items-center justify-between gap-3">
                {o.status === "PENDING_PAYMENT" && o.paymentMethod === "ONLINE" ? (
                  <button onClick={() => payNow(o.id)} disabled={paying === o.id} className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-brand-600 disabled:opacity-60">
                    {paying === o.id ? "Opening payment…" : "Pay now"}
                  </button>
                ) : (
                  <span className="text-xs text-muted">
                    {o.paymentMethod === "COD" ? "Pay on delivery" : "Paid online"}
                    {o.status !== "PENDING_PAYMENT" && o.status !== "CANCELLED" && <> · <Link href={`/invoice/${o.id}`} target="_blank" className="font-semibold text-brand-700 hover:underline">Invoice</Link></>}
                  </span>
                )}
                <p className="font-display text-lg font-bold">{formatPrice(o.totalPaise)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
