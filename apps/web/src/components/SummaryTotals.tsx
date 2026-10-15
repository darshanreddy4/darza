import { formatPrice } from "@/lib/api";
import type { Quote } from "@/lib/quote";

// Subtotal, discount, delivery and total as priced by the server.
export function SummaryTotals({ quote, itemCount, fallbackPaise }: { quote: Quote | null; itemCount: number; fallbackPaise: number }) {
  const total = quote?.totalPaise ?? fallbackPaise;
  return (
    <>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Items ({itemCount})</dt><dd>{formatPrice(quote?.subtotalPaise ?? fallbackPaise)}</dd></div>
        {quote && quote.discountPaise > 0 && (
          <div className="flex justify-between text-brand-700"><dt>Discount{quote.coupon ? ` (${quote.coupon.code})` : ""}</dt><dd>-{formatPrice(quote.discountPaise)}</dd></div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted">Delivery</dt>
          <dd>{!quote ? <span className="text-muted">Calculating…</span> : quote.shippingPaise === 0 ? <span className="font-medium text-brand-700">Free</span> : formatPrice(quote.shippingPaise)}</dd>
        </div>
      </dl>
      {quote && quote.freeShippingGapPaise > 0 && (
        <p className="rounded-lg bg-gold-50 px-3 py-2 text-xs text-amber-900">Add {formatPrice(quote.freeShippingGapPaise)} more to get free delivery.</p>
      )}
      <div className="flex items-baseline justify-between border-t border-line pt-4">
        <span className="font-semibold">Total</span>
        <span className="font-display text-2xl font-bold">{formatPrice(total)}</span>
      </div>
    </>
  );
}
