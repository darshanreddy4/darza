"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/api";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { useAuth } from "@/lib/auth";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, btn, inputCls } from "@/components/admin/ui";

interface ReturnRow {
  id: string; status: "REQUESTED" | "APPROVED" | "REJECTED" | "REFUNDED"; reason: string; details: string | null; adminNote: string | null; createdAt: string;
  user: { name: string; email: string | null; phone: string | null };
  items: { id: string; orderItemId: string; quantity: number; orderItem: { pricePaise: number; product: { name: string } } }[];
  refundPreviewPaise: number; refundPaise: number | null;
  payoutUpi: string | null; payoutRef: string | null; paidOutAt: string | null; payoutDue: boolean;
  order: { id: string; status: string; totalPaise: number; paymentMethod: string; refundedPaise: number };
}

const STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "REFUNDED"] as const;
const LABEL: Record<string, string> = { PAYOUT: "Payouts due", REQUESTED: "Needs review", APPROVED: "Approved", REJECTED: "Declined", REFUNDED: "Refunded" };
const TONE: Record<string, "amber" | "green" | "red" | "slate"> = { REQUESTED: "amber", APPROVED: "green", REJECTED: "red", REFUNDED: "slate" };

export default function ReturnsPage() {
  const call = useAdminApi();
  const staff = useAuth().user?.role === "STAFF";
  const [filter, setFilter] = useState("REQUESTED");
  // "Payouts due" is the refunded pay-on-delivery returns still waiting for the money to be sent.
  const rows = useAdminQuery<ReturnRow[]>(`/admin/returns${filter === "PAYOUT" ? "?status=REFUNDED" : filter ? `?status=${filter}` : ""}`);
  const visible = filter === "PAYOUT" ? (rows.data ?? []).filter((r) => r.payoutDue) : rows.data ?? [];
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function act(r: ReturnRow, action: "approve" | "reject" | "refund" | "paid") {
    if (action === "refund" && !confirm(`Refund ${formatPrice(r.refundPreviewPaise)} for these items on order #${r.order.id.slice(-8).toUpperCase()}? The items go back into stock and this cannot be undone.${r.order.paymentMethod === "ONLINE" ? " The money is refunded through Razorpay." : ` This order was pay on delivery: it will be listed under Payouts due so you can send the money to ${r.payoutUpi ?? "the customer"} and record the reference.`}`)) return;
    setError(""); setNotice(""); setBusy(r.id);
    try {
      await call(`/admin/returns/${r.id}`, { method: "PATCH", body: JSON.stringify({ action, note: notes[r.id]?.trim() || undefined, reference: action === "paid" ? refs[r.id]?.trim() || undefined : undefined }) });
      setNotice(action === "approve" ? "Return approved" : action === "reject" ? "Return declined" : action === "paid" ? "Payout recorded and the customer was told" : "Refund recorded");
      rows.reload();
    } catch (e) { setError((e as Error).message); }
    setBusy(null);
  }

  return (
    <>
      <PageHeader
        title="Returns"
        description="Return requests from delivered orders. Approve or decline, then refund once the item is back."
        actions={
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Filter by status">
            <option value="">All requests</option>
            {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
            <option value="PAYOUT">{LABEL.PAYOUT}</option>
          </select>
        }
      />
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}

      {rows.loading ? <Skeleton rows={3} /> : visible.length === 0 ? (
        <Card><Empty title="No return requests">Requests appear here when customers ask to return a delivered order.</Empty></Card>
      ) : (
        <ul className="space-y-4">
          {visible.map((r) => (
            <li key={r.id}>
              <Card>
                <article aria-label={`Return for order ${r.order.id.slice(-8).toUpperCase()}`} className="space-y-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p><span className="font-mono text-xs font-semibold">#{r.order.id.slice(-8).toUpperCase()}</span> · <span className="font-medium">{r.user.name}</span> <span className="text-xs text-muted">{r.user.email ?? r.user.phone}</span></p>
                    <span className="flex gap-2">{r.payoutDue && <Badge tone="amber">Payout due</Badge>}{r.paidOutAt && <Badge tone="green">Paid out</Badge>}<Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge></span>
                  </div>
                  <p><span className="font-medium">{r.reason}</span>{r.details && <span className="text-muted"> · {r.details}</span>}</p>
                  <ul className="text-xs text-muted">{r.items.map((i) => <li key={i.id}>{i.orderItem.product.name} × {i.quantity} · {formatPrice(i.orderItem.pricePaise * i.quantity)}</li>)}</ul>
                  <p className="text-xs text-muted">Order total {formatPrice(r.order.totalPaise)} · {r.order.paymentMethod === "ONLINE" ? "paid online" : "pay on delivery"} · {r.status === "REFUNDED" ? `refunded ${formatPrice(r.refundPaise ?? 0)}` : `refund would be ${formatPrice(r.refundPreviewPaise)}`} · requested {new Date(r.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
                  {r.adminNote && <p className="rounded-lg bg-canvas px-3 py-2 text-xs">Note sent to customer: {r.adminNote}</p>}
                  {r.paidOutAt && <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">Paid to {r.payoutUpi ?? "the customer"} on {new Date(r.paidOutAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} · reference {r.payoutRef}</p>}
                  {r.payoutDue && (
                    <div className="space-y-3 border-t border-line pt-3">
                      <p className="text-xs">Send <strong>{formatPrice(r.refundPaise ?? 0)}</strong> to UPI ID <strong className="font-mono">{r.payoutUpi ?? "(none given)"}</strong>, then record the transaction reference.</p>
                      {staff ? <p className="text-xs text-muted">An admin records the payout.</p> : (
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="block text-xs font-medium">UPI transaction reference
                            <input value={refs[r.id] ?? ""} maxLength={100} onChange={(e) => setRefs({ ...refs, [r.id]: e.target.value })} className={`${inputCls} mt-1`} />
                          </label>
                          <button disabled={busy === r.id || !(refs[r.id] ?? "").trim()} onClick={() => act(r, "paid")} className={btn.primary}>Mark as paid</button>
                        </div>
                      )}
                    </div>
                  )}

                  {(r.status === "REQUESTED" || r.status === "APPROVED") && (
                    <div className="space-y-3 border-t border-line pt-3">
                      <label className="block text-xs font-medium">Note to the customer {r.status === "REQUESTED" ? "(needed to decline)" : "(optional)"}
                        <input value={notes[r.id] ?? ""} maxLength={500} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} className={`${inputCls} mt-1`} />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {r.status === "REQUESTED" && <button disabled={busy === r.id} onClick={() => act(r, "approve")} className={btn.primary}>Approve return</button>}
                        {r.status === "APPROVED" && !staff && <button disabled={busy === r.id} onClick={() => act(r, "refund")} className={btn.primary}>Item received, refund</button>}
                        <button disabled={busy === r.id} onClick={() => act(r, "reject")} className={btn.danger}>Decline</button>
                      </div>
                    </div>
                  )}
                </article>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
