import { Money, CurrencyNote } from "@/lib/currency";
import type { Quote } from "@/lib/quote";

// Subtotal, discount, delivery and total as priced by the server. The total always shows the rupees that will be charged.
export function SummaryTotals({ quote, itemCount, fallbackPaise }: { quote: Quote | null; itemCount: number; fallbackPaise: number }) {
  const total = quote?.totalPaise ?? fallbackPaise;
  return (
    <>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Items ({itemCount})</dt><dd><Money paise={quote?.subtotalPaise ?? fallbackPaise} /></dd></div>
        {quote && quote.multiBuySavedPaise > 0 && (
          <div className="flex justify-between text-xs font-medium text-green-800"><dt>Multi-buy savings (already included)</dt><dd><Money paise={quote.multiBuySavedPaise} /></dd></div>
        )}
        {quote && quote.rewardDiscountPaise > 0 && (
          <div className="flex justify-between text-brand-700"><dt>Reward ({quote.rewardTitle})</dt><dd>-<Money paise={quote.rewardDiscountPaise} /></dd></div>
        )}
        {quote && quote.discountPaise > 0 && (
          <div className="flex justify-between text-brand-700"><dt>Discount{quote.coupon ? ` (${quote.coupon.code})` : ""}</dt><dd>-<Money paise={quote.discountPaise} /></dd></div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted">Delivery</dt>
          <dd>{!quote ? <span className="text-muted">Calculating…</span> : quote.shippingPaise === 0 ? <span className="font-medium text-brand-700">Free</span> : <Money paise={quote.shippingPaise} />}</dd>
        </div>
        {quote && quote.shippingPaise > 0 && quote.delivery.specialPaise > 0 && (
          <p className="-mt-1 text-xs text-muted">{quote.delivery.standardPaise > 0 ? <>Includes <Money paise={quote.delivery.specialPaise} /> for heavy or bulky items.</> : "For heavy or bulky items in your basket."}</p>
        )}
        {quote && quote.delivery.freeBecause === "ALL" && <p className="-mt-1 text-xs font-medium text-green-800">Your order is big enough for free delivery on everything.</p>}
        {quote && quote.earnedGifts.length > 0 && (
          <div className="flex justify-between gap-3 text-brand-700"><dt>Free gift{quote.earnedGifts.length > 1 ? "s" : ""}</dt><dd className="text-right font-medium">{quote.earnedGifts.join(", ")}</dd></div>
        )}
      </dl>
      {quote && quote.freeShippingGapPaise > 0 && (
        <p className="rounded-lg bg-gold-50 px-3 py-2 text-xs text-amber-900">Add <Money paise={quote.freeShippingGapPaise} /> more to get free delivery{quote.delivery.hasSpecial ? " on your other items" : ""}.</p>
      )}
      {quote && quote.shippingPaise > 0 && quote.delivery.freeAllGapPaise > 0 && (quote.delivery.hasSpecial || quote.freeShippingGapPaise === 0) && (
        <p className="rounded-lg bg-gold-50 px-3 py-2 text-xs text-amber-900">Add <Money paise={quote.delivery.freeAllGapPaise} /> more and delivery is free on everything.</p>
      )}
      <div className="flex items-baseline justify-between border-t border-line pt-4">
        <span className="font-semibold">Total</span>
        <span className="font-display text-2xl font-bold"><Money paise={total} both /></span>
      </div>
      <CurrencyNote totalPaise={total} />
    </>
  );
}
