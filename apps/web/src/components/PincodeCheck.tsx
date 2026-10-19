"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatDeliveryDate, type Product } from "@/lib/api";
import { deliveryDetail, type StoreDelivery } from "@/lib/labels";
import { isPincode, lookupDelivery, lookupPincode, placeName, useSavedPincode, type PincodeInfo } from "@/lib/pincode";

type Outcome = { status: "checking" } | { status: "done"; pin: string; info: PincodeInfo | null; area: StoreDelivery | null };

// "Can you deliver to me?": a PIN code is checked for real, and the answer says where it is, what delivery costs there and when the product would arrive.
export function PincodeCheck({ product, store }: { product: Pick<Product, "deliveryBy" | "freeDelivery" | "chargeDelivery" | "deliveryFeePaise" | "deliveryInfo">; store: StoreDelivery | null }) {
  const { deliveryBy, freeDelivery, deliveryInfo } = product;
  const [saved, setSaved] = useSavedPincode();
  const [draft, setDraft] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const asked = useRef("");

  async function check(pin: string) {
    asked.current = pin;
    setOutcome({ status: "checking" });
    const [info, area] = await Promise.all([lookupPincode(pin), lookupDelivery(pin)]);
    if (asked.current !== pin) return;
    setOutcome({ status: "done", pin, info, area });
    if (info?.valid) setSaved(pin);
  }

  // The PIN code the visitor used before is checked again for this product.
  useEffect(() => {
    if (saved && isPincode(saved) && asked.current !== saved) void check(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (isPincode(draft)) void check(draft);
    else setOutcome({ status: "done", pin: draft, info: { pincode: draft, valid: false, reason: "format", states: [] }, area: null });
  }

  const done = outcome?.status === "done" ? outcome : null;
  const ok = done?.info?.valid ? done.info : null;

  return (
    <section aria-label="Delivery to your PIN code" className="rounded-2xl border border-line p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brand-700"><path d="M12 21s-6.5-5.600-6.500-11a6.500 6.500 0 0 1 13 0c0 5.400-6.500 11-6.500 11z" /><circle cx="12" cy="10" r="2.300" /></svg>
        Delivery
      </p>

      {ok ? (
        <div className="mt-2 space-y-1 text-sm" aria-live="polite">
          <p className="flex flex-wrap items-center gap-x-2">
            <span className="font-medium text-brand-700">✓ We deliver to {placeName(ok) || ok.pincode}</span>
            <span className="text-muted">PIN {ok.pincode}</span>
            <button type="button" onClick={() => { setSaved(""); setDraft(""); setOutcome(null); asked.current = ""; }} className="text-xs font-semibold text-brand-700 hover:underline">Change</button>
          </p>
          <p>{deliveryBy ? <>{freeDelivery ? "FREE delivery " : "Delivery by "}<strong>{formatDeliveryDate(deliveryBy)}</strong></> : deliveryInfo || "Delivery time is confirmed at checkout."}</p>
          {(done?.area ?? store) && <p className="text-muted">{deliveryDetail(product, (done?.area ?? store)!)}</p>}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-2 flex gap-2" noValidate>
          <input value={draft} onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} autoComplete="postal-code" placeholder="Enter your PIN code" aria-label="PIN code"
            className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15" />
          <button className="shrink-0 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-3">Check</button>
        </form>
      )}

      <p aria-live="polite" className="mt-2 text-xs">
        {outcome?.status === "checking" && <span className="text-muted">Checking PIN code…</span>}
        {done && done.info && !done.info.valid && (
          <span role="alert" className="text-red-600">{done.info.reason === "format" ? "Enter a valid 6-digit PIN code." : `We couldn't find PIN code ${done.pin}. Please check it.`}</span>
        )}
        {done && !done.info && <span className="text-amber-800">We couldn&apos;t check this right now. You can still order; your address is checked at checkout.</span>}
      </p>
    </section>
  );
}
