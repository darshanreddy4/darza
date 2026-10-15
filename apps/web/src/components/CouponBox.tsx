"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/api";
import type { Quote } from "@/lib/quote";

export function CouponBox({ code, setCode, quote }: { code: string; setCode: (c: string) => void; quote: Quote | null }) {
  const [draft, setDraft] = useState("");

  if (code) {
    return (
      <div className="rounded-xl bg-brand-50 px-3 py-2.5 text-sm ring-1 ring-brand-200">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-brand-800">{code}{quote?.coupon ? ` applied (-${formatPrice(quote.discountPaise)})` : ""}</span>
          <button type="button" onClick={() => { setCode(""); setDraft(""); }} className="text-xs font-semibold text-red-600 hover:underline">Remove</button>
        </div>
        {quote?.couponError && <p role="alert" className="mt-1 text-xs text-red-700">{quote.couponError}</p>}
      </div>
    );
  }

  const apply = () => { if (draft.trim()) setCode(draft.trim().toUpperCase()); };

  // Not a <form>: on the checkout page this sits inside the checkout form, and forms cannot be nested.
  return (
    <div className="flex gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }}
        maxLength={30}
        placeholder="Coupon code"
        aria-label="Coupon code"
        className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm uppercase outline-none focus:border-brand-500"
      />
      <button type="button" onClick={apply} className="rounded-xl border border-ink px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-white">Apply</button>
    </div>
  );
}
