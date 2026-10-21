"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { API_URL, formatPrice } from "@/lib/api";
import { Money } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { useCart, cartKey } from "@/lib/cart";
import { useBrand } from "@/components/BrandProvider";
import { useCouponCode, useQuote } from "@/lib/quote";
import { IN_STATES } from "@/lib/states";
import type { SavedAddress } from "@/lib/address";
import { payForOrder, type PaymentParams } from "@/lib/razorpay";
import { CouponBox } from "@/components/CouponBox";
import { OfferList } from "@/components/OfferList";
import { PincodeField } from "@/components/PincodeField";
import { RewardsBar } from "@/components/RewardsBar";
import { SummaryTotals } from "@/components/SummaryTotals";
import { VerifyRequired } from "@/components/VerifyRequired";
import { Select } from "@/components/Select";

const field = "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

export default function CheckoutPage() {
  const brand = useBrand();
  const { user, ready } = useAuth();
  const { lines, totalPaise, count, clear } = useCart();
  const router = useRouter();
  const [coupon, setCoupon] = useCouponCode();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [onlineAvailable, setOnlineAvailable] = useState(false);
  const [whatsappOffered, setWhatsappOffered] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const [method, setMethod] = useState<"ONLINE" | "COD">("COD");
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  // The id of a saved address, or "new" to type one in.
  const [choice, setChoice] = useState("new");
  const [typedPin, setTypedPin] = useState("");
  const { quote } = useQuote(lines, coupon, choice === "new" ? typedPin : saved.find((a) => a.id === choice)?.pincode);

  useEffect(() => {
    let stale = false;
    fetch(`${API_URL}/payments/config`)
      .then((r) => (r.ok ? r.json() : { online: false }))
      .then((c: { online: boolean }) => { if (!stale && c.online) { setOnlineAvailable(true); setMethod("ONLINE"); } })
      .catch(() => {});
    fetch(`${API_URL}/store/config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { whatsappUpdates?: boolean } | null) => { if (!stale && c?.whatsappUpdates) setWhatsappOffered(true); })
      .catch(() => {});
    return () => { stale = true; };
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let stale = false;
    fetch(`${API_URL}/addresses`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: SavedAddress[]) => { if (!stale) { setSaved(list); setChoice(list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? "new"); } })
      .catch(() => {});
    return () => { stale = true; };
  }, [userId]);

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/checkout");
  }, [ready, user, router]);

  if (!ready || !user) return <p className="text-sm text-muted">Loading…</p>;
  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-bold">Nothing to check out</h1>
        <Link href="/products?type=OWN" className="mt-4 inline-block text-brand-700 underline">Browse {brand} products</Link>
      </div>
    );
  }

  const total = quote?.totalPaise ?? totalPaise;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    const picked = saved.find((a) => a.id === choice);
    const shipping = picked
      ? { name: picked.name, phone: picked.phone, line1: picked.line1, line2: picked.line2 || undefined, city: picked.city, state: picked.state, pincode: picked.pincode }
      : { name: text("name"), phone: text("phone"), line1: text("line1"), line2: text("line2") || undefined, city: text("city"), state: text("state"), pincode: text("pincode") };
    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: lines.map((l) => ({ productId: l.productId, optionId: l.optionId, quantity: l.quantity })), shipping, paymentMethod: method, couponCode: coupon || undefined, whatsappUpdates: whatsappOffered && whatsapp }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error([body?.message].flat().filter(Boolean).join(", ") || "Could not place your order");
      clear();
      setCoupon("");
      // Saving the address is a convenience; a failure must not affect the order.
      if (!picked && f.get("saveAddress")) {
        fetch(`${API_URL}/addresses`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(shipping) }).catch(() => {});
      }

      if (method === "ONLINE" && body.payment) {
        const result = await payForOrder(body.payment as PaymentParams, { name: user!.name, email: user!.email, phone: user!.phone }, brand);
        router.replace(result.status === "paid" ? "/orders?placed=paid" : result.status === "failed" ? `/orders?placed=unpaid&reason=${encodeURIComponent(result.message)}` : "/orders?placed=unpaid");
        return;
      }
      router.replace("/orders?placed=1");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Checkout</h1>
      <RewardsBar quote={quote} />
      <VerifyRequired action="place an order" />
      <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4 rounded-3xl border border-line bg-white p-7 shadow-card">
          <h2 className="text-lg font-bold">Delivery address</h2>
          {saved.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Saved addresses">
              {saved.map((a) => (
                <button type="button" key={a.id} role="radio" aria-checked={choice === a.id} onClick={() => setChoice(a.id)}
                  className={`rounded-xl border-2 p-4 text-left text-sm transition ${choice === a.id ? "border-brand-500 bg-brand-50" : "border-line hover:border-ink/30"}`}>
                  <span className="flex items-center justify-between gap-2 font-semibold">{a.label || a.name}{a.isDefault && <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-semibold ring-1 ring-line">Default</span>}</span>
                  <span className="mt-1 block text-muted">{a.name}, {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}</span>
                  <span className="block text-muted">Phone {a.phone}</span>
                </button>
              ))}
              <button type="button" role="radio" aria-checked={choice === "new"} onClick={() => setChoice("new")}
                className={`rounded-xl border-2 border-dashed p-4 text-left text-sm font-semibold transition ${choice === "new" ? "border-brand-500 bg-brand-50" : "border-line hover:border-ink/30"}`}>
                + Use a different address
              </button>
            </div>
          )}
          {choice === "new" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <input name="name" required defaultValue={user.name} placeholder="Full name" autoComplete="name" className={field} />
                <input name="phone" required pattern="[6-9][0-9]{9}" inputMode="numeric" placeholder="10-digit mobile number" autoComplete="tel-national" className={field} />
                <input name="line1" required minLength={3} placeholder="Address line 1" autoComplete="address-line1" className={`${field} sm:col-span-2`} />
                <input name="line2" placeholder="Address line 2 (optional)" autoComplete="address-line2" className={`${field} sm:col-span-2`} />
                <input name="city" required placeholder="City" autoComplete="address-level2" className={field} />
                <Select name="state" required defaultValue="" autoComplete="address-level1" aria-label="State" className={field}>
                  <option value="" disabled>Select state</option>
                  {IN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
                <PincodeField className={field} onPincode={setTypedPin} />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="saveAddress" defaultChecked className="h-4 w-4 accent-emerald-600" /> Save this address for next time</label>
            </>
          )}
          <h2 className="pt-2 text-lg font-bold">Payment method</h2>
          <div className="grid gap-3" role="radiogroup" aria-label="Payment method">
            {onlineAvailable && (
              <PaymentOption selected={method === "ONLINE"} onSelect={() => setMethod("ONLINE")} title="Pay online" text="UPI, cards, netbanking and wallets via Razorpay. Your order is confirmed as soon as payment succeeds." />
            )}
            <PaymentOption selected={method === "COD"} onSelect={() => setMethod("COD")} title="Pay on delivery" text="Pay in cash or by UPI when your order arrives." />
          </div>
          {whatsappOffered && (
            <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-4 text-sm">
              <input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600" />
              <span><span className="font-medium">Send my order updates on WhatsApp</span><br /><span className="text-xs text-muted">We message the phone number on this order when it is placed, shipped, delivered, cancelled or refunded. No marketing.</span></span>
            </label>
          )}
        </section>

        <aside className="h-fit space-y-4 rounded-3xl border border-line bg-white p-7 shadow-card lg:sticky lg:top-40">
          <h2 className="text-lg font-bold">Order summary</h2>
          <ul className="space-y-2 text-sm">
            {lines.map((l) => { const priced = quote?.lines.find((q) => q.productId === l.productId && (q.optionId ?? null) === (l.optionId ?? null)); const unit = priced?.unitPaise ?? l.pricePaise; return <li key={cartKey(l)} className="flex justify-between gap-3"><span className="truncate">{l.name}{l.optionLabel ? ` (${l.optionLabel})` : ""} × {l.quantity}{priced?.returnDays === 0 && <span className="ml-1.5 text-xs font-medium text-amber-800">(no returns)</span>}</span><span><Money paise={unit * l.quantity} /></span></li>; })}
          </ul>
          <CouponBox code={coupon} setCode={setCoupon} quote={quote} />
          <OfferList quote={quote} setCode={setCoupon} />
          <SummaryTotals quote={quote} itemCount={count} fallbackPaise={totalPaise} />
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button disabled={busy || !user.verified || !!quote?.couponError} className="w-full rounded-xl bg-brand-500 px-6 py-3.5 font-semibold text-ink shadow-lg shadow-brand-500/25 hover:bg-brand-600 disabled:opacity-60">{busy ? (method === "ONLINE" ? "Opening payment…" : "Placing order…") : method === "ONLINE" ? `Pay ${formatPrice(total)}` : "Place order"}</button>
        </aside>
      </form>
    </div>
  );
}

function PaymentOption({ selected, onSelect, title, text }: { selected: boolean; onSelect: () => void; title: string; text: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition ${selected ? "border-brand-500 bg-brand-50" : "border-line hover:border-ink/30"}`}
    >
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-brand-600" : "border-line"}`}>
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{text}</span>
      </span>
    </button>
  );
}
