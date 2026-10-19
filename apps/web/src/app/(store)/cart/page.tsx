"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { useBrand } from "@/components/BrandProvider";
import { imgSized } from "@/lib/api";
import { Money } from "@/lib/currency";
import { multiBuyText } from "@/lib/labels";
import { ImageFallback } from "@/components/ProductCard";
import { CouponBox } from "@/components/CouponBox";
import { OfferList } from "@/components/OfferList";
import { SummaryTotals } from "@/components/SummaryTotals";
import { useCouponCode, useQuote } from "@/lib/quote";
import { isPincode, useSavedPincode } from "@/lib/pincode";
import { RewardsBar } from "@/components/RewardsBar";
import { useCheckoutGate } from "@/components/LoginPrompt";

export default function CartPage() {
  const brand = useBrand();
  const { lines, setQuantity, remove, totalPaise, count } = useCart();
  const [coupon, setCoupon] = useCouponCode();
  // The PIN code the visitor checked on a product page, so an area's delivery fee is already in the cart.
  const [savedPin] = useSavedPincode();
  const { quote } = useQuote(lines, coupon, isPincode(savedPin) ? savedPin : undefined);
  const gate = useCheckoutGate();

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-line bg-white p-12 text-center shadow-card">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <svg aria-hidden width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.5L20.5 8H6.2" /><circle cx="10" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" /></svg>
        </div>
        <h1 className="mt-5 text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-1 text-sm text-muted">Products sold by {brand} appear here when you add them.</p>
        <Link href="/products?type=OWN" className="mt-6 inline-block rounded-xl bg-brand-500 px-6 py-3 font-semibold text-ink hover:bg-brand-600">Shop {brand} products</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Your cart</h1>
        <p className="mt-1 text-sm text-muted">This cart contains only products sold and fulfilled by {brand}. Partner products are purchased on the partner&apos;s site.</p>
      </div>

      <RewardsBar quote={quote} />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white shadow-card">
          {lines.map((l) => {
            const priced = quote?.lines.find((q) => q.productId === l.productId);
            const unit = priced?.unitPaise ?? l.pricePaise;
            return (
            <li key={l.productId} className="flex items-center gap-4 p-5">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-canvas">
                {l.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgSized(l.image, 160)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageFallback name={l.name} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/products/${l.slug}`} className="line-clamp-2 font-semibold hover:text-brand-700">{l.name}</Link>
                <p className="mt-0.5 text-sm text-muted"><Money paise={unit} /> each</p>
                {priced && priced.savedPaise > 0 && <p className="mt-0.5 text-xs font-semibold text-green-800">Multi-buy: you save <Money paise={priced.savedPaise} /></p>}
                {priced?.returnDays === 0 && <p className="mt-0.5 text-xs font-medium text-amber-800">No returns on this item</p>}
                {priced?.buyMoreFor && <p className="mt-0.5 text-xs font-semibold text-green-800">{multiBuyText(priced.buyMoreFor)}</p>}
              </div>
              <div className="flex items-center overflow-hidden rounded-xl border border-line">
                <button onClick={() => setQuantity(l.productId, l.quantity - 1)} className="px-3 py-2 hover:bg-canvas" aria-label="Decrease quantity">−</button>
                <span className="w-8 text-center text-sm font-semibold" aria-live="polite">{l.quantity}</span>
                <button onClick={() => setQuantity(l.productId, l.quantity + 1)} className="px-3 py-2 hover:bg-canvas" aria-label="Increase quantity">+</button>
              </div>
              <p className="w-24 text-right font-display font-bold"><Money paise={unit * l.quantity} /></p>
              <button onClick={() => remove(l.productId)} aria-label={`Remove ${l.name} from your cart`} title="Remove" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-red-50 hover:text-red-600">
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
              </button>
            </li>
            );
          })}
        </ul>

        <aside className="h-fit space-y-4 rounded-3xl border border-line bg-white p-7 shadow-card lg:sticky lg:top-40">
          <h2 className="text-lg font-bold">Order summary</h2>
          <CouponBox code={coupon} setCode={setCoupon} quote={quote} />
          <OfferList quote={quote} setCode={setCoupon} />
          <SummaryTotals quote={quote} itemCount={count} fallbackPaise={totalPaise} />
          <Link href="/checkout" onClick={gate.guard} className="block w-full rounded-xl bg-brand-500 px-6 py-3.5 text-center font-semibold text-ink shadow-lg shadow-brand-500/25 hover:bg-brand-600">
            Proceed to checkout
          </Link>
          <p className="text-center text-xs text-muted">Pay online or on delivery at checkout.</p>
          {gate.prompt}
        </aside>
      </div>
    </div>
  );
}
