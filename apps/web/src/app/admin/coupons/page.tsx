"use client";

import { useState, Fragment, type FormEvent } from "react";
import { formatPrice } from "@/lib/api";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, btn, inputCls, td, th } from "@/components/admin/ui";
import { Select } from "@/components/Select";

interface Coupon {
  id: string; code: string; description: string | null; type: "PERCENT" | "FLAT"; value: number; minOrderPaise: number; maxDiscountPaise: number | null;
  startsAt: string | null; endsAt: string | null; usageLimit: number | null; perUserLimit: number | null; active: boolean; timesUsed: number; discountGivenPaise: number;
  firstOrderOnly: boolean; visible: boolean; customers: { id: string; name: string; email: string | null; phone: string | null }[];
}

interface Use { orderId: string; status: string; createdAt: string; discountPaise: number; totalPaise: number; counted: boolean; customer: { name: string; email: string | null; phone: string | null }; deliveryPhone: string | null }

const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : undefined);
const rupees = (paise: number | null) => (paise === null ? "" : String(paise / 100));
const offer = (c: Coupon) => (c.type === "PERCENT" ? `${c.value}% off${c.maxDiscountPaise ? ` (up to ${formatPrice(c.maxDiscountPaise)})` : ""}` : `${formatPrice(c.value)} off`);

function state(c: Coupon, now = Date.now()): { label: string; tone: "green" | "amber" | "slate" | "red" } {
  if (!c.active) return { label: "Off", tone: "slate" };
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { label: "Scheduled", tone: "amber" };
  if (c.endsAt && new Date(c.endsAt).getTime() <= now) return { label: "Expired", tone: "red" };
  if (c.usageLimit !== null && c.timesUsed >= c.usageLimit) return { label: "Used up", tone: "red" };
  return { label: "Live", tone: "green" };
}

export default function CouponsPage() {
  const call = useAdminApi();
  const coupons = useAdminQuery<Coupon[]>("/admin/coupons");
  // "new", a coupon id, or null when the form is closed.
  const [editing, setEditing] = useState<string | null>(null);
  const [usageOf, setUsageOf] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const list = coupons.data ?? [];
  const current = list.find((c) => c.id === editing);

  async function act(fn: () => Promise<unknown>, message: string) {
    setError(""); setNotice("");
    try { await fn(); setNotice(message); coupons.reload(); } catch (e) { setError((e as Error).message); }
  }
  const body = (c: Coupon, over: Partial<Coupon> = {}) => {
    const m = { ...c, ...over };
    return JSON.stringify({
      code: m.code, description: m.description ?? undefined, type: m.type, value: m.value, minOrderPaise: m.minOrderPaise,
      maxDiscountPaise: m.maxDiscountPaise ?? undefined, startsAt: m.startsAt ?? undefined, endsAt: m.endsAt ?? undefined,
      usageLimit: m.usageLimit ?? undefined, perUserLimit: m.perUserLimit ?? undefined, active: m.active, firstOrderOnly: m.firstOrderOnly, visible: m.visible,
    });
  };

  return (
    <>
      <PageHeader title="Coupons" description="Discount codes customers can enter in the cart or at checkout." actions={editing === null ? <button onClick={() => setEditing("new")} className={btn.primary}>+ New coupon</button> : undefined} />
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
      {coupons.error && <Alert tone="error">Could not load your coupons: {coupons.error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}

      {editing !== null && (
        <div className="mb-6">
          <CouponForm key={editing} initial={current} onCancel={() => setEditing(null)} onSubmit={(payload) => act(async () => {
            await call(current ? `/admin/coupons/${current.id}` : "/admin/coupons", { method: current ? "PUT" : "POST", body: JSON.stringify(payload) });
            setEditing(null);
          }, current ? "Coupon updated" : "Coupon created")} />
        </div>
      )}

      <Card padded={false}>
        {coupons.loading ? <Skeleton /> : coupons.error ? <Empty title="Coupons could not be loaded">Your coupons are safe. Refresh the page, and if this stays, restart the API.</Empty> : list.length === 0 ? <Empty title="No coupons yet">Create one for a festival sale or a first-order offer.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas/60"><th className={th}>Code</th><th className={th}>Offer</th><th className={th}>Rules</th><th className={th}>Used</th><th className={th}>Status</th><th className={`${th} text-right`}>Actions</th></tr></thead>
              <tbody className="divide-y divide-line">
                {list.map((c) => {
                  const s = state(c);
                  return (
                    <Fragment key={c.id}>
                    <tr className="hover:bg-canvas/60">
                      <td className={td}><p className="font-mono font-semibold">{c.code}</p>{c.description && <p className="text-xs text-muted">{c.description}</p>}</td>
                      <td className={td}>{offer(c)}</td>
                      <td className={`${td} text-xs text-muted`}>
                        {c.minOrderPaise > 0 && <p>Min order {formatPrice(c.minOrderPaise)}</p>}
                        {c.customers.length > 0 && <p className="font-medium text-ink">Only for {c.customers.length === 1 ? `${c.customers[0].name} (${c.customers[0].email ?? c.customers[0].phone})` : `${c.customers.length} chosen customers`}</p>}
                        {c.firstOrderOnly && <p>First order only</p>}
                        {!c.visible && <p>Hidden: not listed in carts</p>}
                        {c.perUserLimit !== null && <p>{c.perUserLimit} per customer</p>}
                        {c.startsAt && <p>From {new Date(c.startsAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>}
                        {c.endsAt && <p>Until {new Date(c.endsAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>}
                      </td>
                      <td className={td}>{c.timesUsed}{c.usageLimit !== null ? ` / ${c.usageLimit}` : ""}{c.discountGivenPaise > 0 && <p className="text-xs text-muted">{formatPrice(c.discountGivenPaise)} given</p>}</td>
                      <td className={td}><Badge tone={s.tone}>{s.label}</Badge></td>
                      <td className={`${td} text-right`}>
                        <div className="flex justify-end gap-2">
                          <button className={btn.secondary + " !px-3 !py-1.5"} aria-expanded={usageOf === c.id} onClick={() => setUsageOf(usageOf === c.id ? null : c.id)}>Usage</button>
                          <button className={btn.secondary + " !px-3 !py-1.5"} onClick={() => act(() => call(`/admin/coupons/${c.id}`, { method: "PUT", body: body(c, { active: !c.active }) }), c.active ? "Coupon switched off" : "Coupon switched on")}>{c.active ? "Switch off" : "Switch on"}</button>
                          <button className={btn.secondary + " !px-3 !py-1.5"} onClick={() => setEditing(c.id)}>Edit</button>
                          <button className={btn.danger} onClick={() => confirm(`Delete coupon ${c.code}?`) && act(() => call(`/admin/coupons/${c.id}`, { method: "DELETE" }), "Coupon deleted")}>Delete</button>
                        </div>
                      </td>
                    </tr>
                    {usageOf === c.id && <tr><td colSpan={6} className="bg-canvas/60 px-5 py-4"><UsagePanel id={c.id} /></td></tr>}
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

function UsagePanel({ id }: { id: string }) {
  const uses = useAdminQuery<Use[]>(`/admin/coupons/${id}/usage`);
  if (uses.loading) return <Skeleton rows={2} />;
  const list = uses.data ?? [];
  if (list.length === 0) return <p className="text-sm text-muted">Nobody has used this code yet.</p>;
  return (
    <table className="w-full text-sm" aria-label="Orders that used this code">
      <thead><tr className="text-left text-xs uppercase tracking-wider text-muted"><th className="py-1 pr-3">Order</th><th className="py-1 pr-3">Customer</th><th className="py-1 pr-3">Date</th><th className="py-1 pr-3 text-right">Discount</th><th className="py-1">Counts against limits</th></tr></thead>
      <tbody className="divide-y divide-line">
        {list.map((u) => (
          <tr key={u.orderId}>
            <td className="py-1.5 pr-3 font-mono text-xs">#{u.orderId.slice(-8).toUpperCase()}</td>
            <td className="py-1.5 pr-3">{u.customer.name}<span className="block text-xs text-muted">{[u.customer.email, u.customer.phone, u.deliveryPhone && `delivery ${u.deliveryPhone}`].filter(Boolean).join(" · ")}</span></td>
            <td className="py-1.5 pr-3">{new Date(u.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
            <td className="py-1.5 pr-3 text-right">{formatPrice(u.discountPaise)}</td>
            <td className="py-1.5">{u.counted ? <Badge tone="green">Yes</Badge> : <Badge tone="slate">Released ({u.status.toLowerCase()})</Badge>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CouponForm({ initial, onCancel, onSubmit }: { initial?: Coupon; onCancel: () => void; onSubmit: (payload: Record<string, unknown>) => void }) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<"PERCENT" | "FLAT">(initial?.type ?? "PERCENT");
  const [value, setValue] = useState(initial ? (initial.type === "PERCENT" ? String(initial.value) : rupees(initial.value)) : "");
  const [min, setMin] = useState(rupees(initial?.minOrderPaise || null));
  const [max, setMax] = useState(rupees(initial?.maxDiscountPaise ?? null));
  const [startsAt, setStartsAt] = useState(toLocal(initial?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocal(initial?.endsAt ?? null));
  const [limit, setLimit] = useState(initial?.usageLimit ? String(initial.usageLimit) : "");
  const [perUser, setPerUser] = useState(initial?.perUserLimit ? String(initial.perUserLimit) : "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [customers, setCustomers] = useState((initial?.customers ?? []).map((c) => c.email ?? c.phone ?? "").filter(Boolean).join("\n"));
  const [firstOrder, setFirstOrder] = useState(initial?.firstOrderOnly ?? false);
  const [visible, setVisible] = useState(initial?.visible ?? true);

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(value);
    onSubmit({
      code: code.trim().toUpperCase(), description: description.trim() || undefined, type,
      value: type === "PERCENT" ? Math.round(n) : Math.round(n * 100),
      minOrderPaise: min ? Math.round(Number(min) * 100) : 0,
      maxDiscountPaise: type === "PERCENT" && max ? Math.round(Number(max) * 100) : undefined,
      startsAt: toIso(startsAt), endsAt: toIso(endsAt),
      usageLimit: limit ? Math.round(Number(limit)) : undefined, perUserLimit: perUser ? Math.round(Number(perUser)) : undefined, active,
      customers: customers.trim(), firstOrderOnly: firstOrder, visible,
    });
  }

  const label = "block text-sm font-medium";
  const hint = "mt-1 text-xs text-muted";
  return (
    <Card title={initial ? `Edit ${initial.code}` : "New coupon"}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Code
            <input required value={code} maxLength={20} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="DIWALI10" className={`${inputCls} mt-1.5 font-mono`} />
            <span className={hint}>Letters, digits, - or _. Customers can type it in any case.</span>
          </label>
          <label className={label}>Note for yourself <span className="font-normal text-muted">optional</span>
            <input value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="Festival sale 2026" className={`${inputCls} mt-1.5`} />
          </label>
          <label className={label}>Discount type
            <Select value={type} onChange={(e) => setType(e.target.value as "PERCENT" | "FLAT")} className={`${inputCls} mt-1.5`}>
              <option value="PERCENT">Percentage off</option><option value="FLAT">Fixed amount off</option>
            </Select>
          </label>
          <label className={label}>{type === "PERCENT" ? "Percentage (1-100)" : "Amount (₹)"}
            <input required type="number" min={type === "PERCENT" ? 1 : 0.01} max={type === "PERCENT" ? 100 : undefined} step={type === "PERCENT" ? 1 : 0.01} value={value} onChange={(e) => setValue(e.target.value)} className={`${inputCls} mt-1.5`} />
          </label>
          <label className={label}>Minimum order (₹) <span className="font-normal text-muted">optional</span>
            <input type="number" min={0} step="0.01" value={min} onChange={(e) => setMin(e.target.value)} className={`${inputCls} mt-1.5`} />
          </label>
          {type === "PERCENT" && (
            <label className={label}>Maximum discount (₹) <span className="font-normal text-muted">optional</span>
              <input type="number" min={1} step="0.01" value={max} onChange={(e) => setMax(e.target.value)} className={`${inputCls} mt-1.5`} />
              <span className={hint}>Caps big baskets, e.g. 10% off up to ₹200.</span>
            </label>
          )}
          <label className={label}>Valid from <span className="font-normal text-muted">optional</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={`${inputCls} mt-1.5`} />
          </label>
          <label className={label}>Valid until <span className="font-normal text-muted">optional</span>
            <input type="datetime-local" value={endsAt} min={startsAt || undefined} onChange={(e) => setEndsAt(e.target.value)} className={`${inputCls} mt-1.5`} />
          </label>
          <label className={label}>Total uses allowed <span className="font-normal text-muted">optional</span>
            <input type="number" min={1} step={1} value={limit} onChange={(e) => setLimit(e.target.value)} className={`${inputCls} mt-1.5`} />
          </label>
          <label className={label}>Uses per customer <span className="font-normal text-muted">optional</span>
            <input type="number" min={1} step={1} value={perUser} onChange={(e) => setPerUser(e.target.value)} className={`${inputCls} mt-1.5`} />
            <span className={hint}>A customer is counted by account, email address and mobile number, so a second account with the same email or phone cannot use the code again.</span>
          </label>
          <label className={`${label} sm:col-span-2`}>Only for these customers <span className="font-normal text-muted">optional</span>
            <textarea value={customers} rows={2} maxLength={5000} onChange={(e) => setCustomers(e.target.value)} placeholder="Their emails or mobile numbers, one per line" className={`${inputCls} mt-1.5`} />
            <span className={hint}>Leave empty for a code anyone can use. With names in it, the code shows in each customer&apos;s account and nobody else can use it. It can be used once per customer unless you set uses per customer.</span>
          </label>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={firstOrder} onChange={(e) => setFirstOrder(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> For first orders only
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
          <span><span className="font-medium">Show this code to customers who can use it</span><br /><span className="text-xs text-muted">It is listed in their cart and checkout, and shown on the progress bar at the amount where it unlocks (the minimum order), so they know how much more to spend. Switch off for codes you hand out yourself.</span></span>
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Active
        </label>
        <div className="flex gap-3">
          <button className={btn.primary}>{initial ? "Save changes" : "Create coupon"}</button>
          <button type="button" onClick={onCancel} className={btn.secondary}>Cancel</button>
        </div>
      </form>
    </Card>
  );
}
