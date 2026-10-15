"use client";

import { Fragment, useState } from "react";
import { formatPrice } from "@/lib/api";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { useAuth } from "@/lib/auth";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, inputCls, td, th } from "@/components/admin/ui";
import { useBrand } from "@/components/BrandProvider";

interface Order {
  id: string; status: string; totalPaise: number; createdAt: string; paymentMethod: string; shippingName: string; cancelReason?: string | null;
  subtotalPaise: number; discountPaise: number; shippingPaise: number; couponCode: string | null; refundId: string | null; whatsappOptIn?: boolean; refundedPaise: number; paymentId: string | null;
  shippingAddr: { name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string };
  user: { name: string; email: string | null; phone: string | null };
  items: { id: string; quantity: number; pricePaise: number; costPaise: number | null; product: { name: string } }[];
}

const STATUSES = ["PENDING_PAYMENT", "PLACED", "PAID", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
const LABEL = (s: string) => (s === "PENDING_PAYMENT" ? "Awaiting payment" : s.charAt(0) + s.slice(1).toLowerCase());
const TONE: Record<string, "green" | "amber" | "slate" | "red"> = { PLACED: "amber", PAID: "green", SHIPPED: "green", DELIVERED: "green", CANCELLED: "red", REFUNDED: "red", PENDING_PAYMENT: "slate" };

export default function OrdersAdminPage() {
  const brand = useBrand();
  const call = useAdminApi();
  const staff = useAuth().user?.role === "STAFF";
  const [filter, setFilter] = useState("");
  const orders = useAdminQuery<Order[]>(`/admin/orders${filter ? `?status=${filter}` : ""}`);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function setStatus(o: Order, status: string) {
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
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{LABEL(s)}</option>)}
          </select>
        }
      />
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}

      <Card padded={false}>
        {orders.loading ? <Skeleton /> : (orders.data ?? []).length === 0 ? <Empty title="No orders yet">Orders appear here when customers check out.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas/60"><th className={th}>Order</th><th className={th}>Customer</th><th className={th}>Date</th><th className={`${th} text-right`}>Total</th><th className={th}>Status</th></tr></thead>
              <tbody className="divide-y divide-line">
                {orders.data!.map((o) => {
                  const final = o.status === "CANCELLED" || o.status === "REFUNDED";
                  return (
                    <Fragment key={o.id}>
                      <tr className="hover:bg-canvas/60">
                        <td className={td}><button onClick={() => setOpen(open === o.id ? null : o.id)} className="py-1.5 font-mono text-xs font-semibold text-brand-700 hover:underline" aria-expanded={open === o.id}>#{o.id.slice(-8).toUpperCase()}</button></td>
                        <td className={td}><p className="font-medium">{o.user.name}</p><p className="text-xs text-muted">{o.user.email ?? o.user.phone}</p></td>
                        <td className={td}>{new Date(o.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                        <td className={`${td} text-right font-semibold`}>{formatPrice(o.totalPaise)}</td>
                        <td className={td}>
                          {final ? <Badge tone={TONE[o.status]}>{o.status.toLowerCase()}</Badge> : (
                            <select value={o.status} onChange={(e) => setStatus(o, e.target.value)} className={`${inputCls} !w-auto py-1.5`} aria-label={`Status for order ${o.id.slice(-8)}`}>
                              {STATUSES.filter((s) => !staff || (s !== "CANCELLED" && s !== "REFUNDED")).map((s) => <option key={s} value={s}>{LABEL(s)}</option>)}
                            </select>
                          )}
                        </td>
                      </tr>
                      {open === o.id && (
                        <tr><td colSpan={5} className="bg-canvas/60 px-5 py-4">
                          <div className="grid gap-6 md:grid-cols-2">
                            <div>
                              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Items</h3>
                              <ul className="space-y-1 text-sm">{o.items.map((i) => <li key={i.id} className="flex justify-between"><span>{i.product.name} × {i.quantity}</span><span>{formatPrice(i.pricePaise * i.quantity)}</span></li>)}</ul>
                              <dl className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-muted">
                                <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(o.subtotalPaise)}</dd></div>
                                {o.discountPaise > 0 && <div className="flex justify-between"><dt>Discount{o.couponCode ? ` (${o.couponCode})` : ""}</dt><dd>-{formatPrice(o.discountPaise)}</dd></div>}
                                <div className="flex justify-between"><dt>Delivery</dt><dd>{o.shippingPaise > 0 ? formatPrice(o.shippingPaise) : "Free"}</dd></div>
                                <div className="flex justify-between font-semibold text-ink"><dt>Total</dt><dd>{formatPrice(o.totalPaise)}</dd></div>
                              </dl>
                              {o.status === "CANCELLED" && o.cancelReason && <p className="mt-2 text-xs text-muted">Cancellation reason: {o.cancelReason}</p>}
                              <p className="mt-2 text-xs text-muted">Payment: {o.paymentMethod === "COD" ? "Pay on delivery" : "Online (Razorpay)"}{o.status !== "PENDING_PAYMENT" && o.status !== "CANCELLED" && <> · <a href={`/invoice/${o.id}`} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">Open invoice</a></>}</p>
                              {o.whatsappOptIn && <p className="mt-1 text-xs text-muted">WhatsApp updates on for {o.shippingAddr.phone}</p>}
                              {o.refundedPaise > 0 && <p className="mt-1 text-xs font-medium text-brand-800">Refunded {formatPrice(o.refundedPaise)} through Razorpay{o.refundId ? ` (${o.refundId})` : ""}</p>}
                            </div>
                            <div>
                              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Ship to</h3>
                              <address className="text-sm not-italic leading-relaxed">
                                {o.shippingAddr.name}<br />{o.shippingAddr.line1}{o.shippingAddr.line2 ? `, ${o.shippingAddr.line2}` : ""}<br />
                                {o.shippingAddr.city}, {o.shippingAddr.state} {o.shippingAddr.pincode}<br />Phone: {o.shippingAddr.phone}
                              </address>
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
