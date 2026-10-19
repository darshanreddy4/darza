"use client";

import { Money } from "@/lib/currency";
import type { Quote } from "@/lib/quote";

// Codes this shopper can use on their cart, listed by default: ready to use, or locked until they spend a little more.
export function OfferList({ quote, setCode }: { quote: Quote | null; setCode: (code: string) => void }) {
  const offers = quote?.offers ?? [];
  if (offers.length === 0) return null;
  // About three offers fit; more scroll inside this block so the order summary stays short.
  const scrolls = offers.length > 3;

  return (
    <section aria-label="Offers for you" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Offers for you</h3>
        {scrolls && <span className="text-[11px] text-muted">{offers.length} offers, scroll for more</span>}
      </div>
      <ul
        tabIndex={scrolls ? 0 : undefined} aria-label={scrolls ? "Offers, scrollable" : undefined}
        className={`space-y-2 ${scrolls ? "max-h-[20.5rem] overflow-y-auto overscroll-contain rounded-xl pr-1 [scrollbar-width:thin]" : ""}`}
      >
        {offers.map((o) => {
          const applied = quote?.coupon?.code === o.code;
          return (
            <li key={o.code} className={`flex items-center justify-between gap-3 rounded-xl border border-dashed p-3 text-sm ${o.unlocked ? "border-brand-300 bg-brand-50/60" : "border-line bg-canvas/60"}`}>
              <div className="min-w-0">
                <p className="font-mono text-sm font-bold">{o.code}</p>
                <p className="text-xs text-ink-3">
                  {o.type === "PERCENT" ? `${o.value}% off` : <><Money paise={o.value} /> off</>}
                  {o.maxDiscountPaise ? <> up to <Money paise={o.maxDiscountPaise} /></> : null}
                  {o.minOrderPaise > 0 ? <> on orders of <Money paise={o.minOrderPaise} /> or more</> : null}
                </p>
                {!o.unlocked && <p className="mt-0.5 text-xs font-medium text-amber-800">Add <Money paise={o.remainingPaise} /> more to use this code</p>}
                {o.unlocked && !applied && o.discountPaise > 0 && <p className="mt-0.5 text-xs font-medium text-brand-700">Save <Money paise={o.discountPaise} /> on this cart</p>}
                {o.endsAt && <p className="text-[11px] text-muted">Valid until {new Date(o.endsAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>}
              </div>
              {applied
                ? <span className="shrink-0 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-ink">Applied</span>
                : <button type="button" disabled={!o.unlocked} onClick={() => setCode(o.code)} aria-label={`Use code ${o.code}`} className="shrink-0 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-ink-3 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted">{o.unlocked ? "Use code" : "Locked"}</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
