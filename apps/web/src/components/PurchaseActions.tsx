"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart, cartKey } from "@/lib/cart";
import { API_URL, type Product } from "@/lib/api";
import { Money } from "@/lib/currency";
import { useCheckoutGate } from "./LoginPrompt";
import { NotifyMe } from "./NotifyMe";
import { useOptionText, useSelectedOption } from "./ProductOptions";

export function PurchaseActions({ product: shown }: { product: Product }) {
  const cart = useCart();
  const option = useSelectedOption();
  const optionText = useOptionText();
  // With sizes, what can be bought (and for how much) is the chosen size's.
  const product = option ? { ...shown, pricePaise: option.pricePaise, inStock: option.inStock } : shown;
  const gate = useCheckoutGate();
  const [added, setAdded] = useState(false);
  const inline = useRef<HTMLDivElement>(null);
  const [inlineVisible, setInlineVisible] = useState(true);

  // On a phone, the buy buttons follow the visitor once the main ones have scrolled away.
  useEffect(() => {
    const el = inline.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const watch = new IntersectionObserver(([entry]) => setInlineVisible(entry.isIntersecting));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  const addLine = () => cart.add({
    productId: product.id,
    slug: product.slug,
    name: product.name,
    image: product.images[0]?.url ?? null,
    pricePaise: product.pricePaise,
    optionId: option?.id,
    optionLabel: option?.label,
    optionText: optionText || undefined,
  });
  const buyNow = () => {
    if (!cart.lines.some((l) => cartKey(l) === cartKey({ productId: product.id, optionId: option?.id }))) addLine();
    gate.go();
  };

  if (product.productType === "OWN") {
    return (
      <div className="space-y-3">
        <div ref={inline} className="space-y-3">
        <button
          disabled={!product.inStock}
          onClick={() => { addLine(); setAdded(true); }}
          className="w-full rounded-xl bg-brand-500 px-6 py-3.5 font-semibold text-ink shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-line disabled:text-muted disabled:shadow-none"
        >
          {!product.inStock ? "Out of stock" : added ? "Added to cart ✓ — add another" : "Add to Cart"}
        </button>
        {product.inStock && (
          <button type="button" onClick={buyNow} className="w-full rounded-xl bg-ink px-6 py-3.5 font-semibold text-white transition hover:bg-ink-3 active:scale-[0.99]">
            Buy now
          </button>
        )}
        </div>
        {!product.inStock && <NotifyMe slug={product.slug} />}
        {added && (
          <Link href="/cart" className="block w-full rounded-xl border border-ink px-6 py-3 text-center font-semibold hover:bg-ink hover:text-white">
            Go to cart
          </Link>
        )}
        <p className="flex items-center gap-2 text-sm text-muted">
          <span className="h-2 w-2 rounded-full bg-brand-500" /> Sold and fulfilled by {product.sellerName}
        </p>
        {product.inStock && !inlineVisible && (
          <div className="fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t border-line bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-lift backdrop-blur lg:hidden">
            <button type="button" onClick={() => { addLine(); setAdded(true); }} className="flex-1 rounded-xl border border-line px-4 py-3 text-sm font-semibold hover:border-ink">Quick add</button>
            <button type="button" onClick={buyNow} className="flex-[1.4] rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-ink hover:bg-brand-600">Buy at <Money paise={product.pricePaise} /></button>
          </div>
        )}
        {gate.prompt}
      </div>
    );
  }

  const platform = product.platform ?? "partner site";
  return (
    <div className="space-y-3">
      <a
        href={`${API_URL}/go/${product.slug}`}
        target="_blank"
        rel="noopener noreferrer sponsored nofollow"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3.5 font-semibold text-ink shadow-lg shadow-gold/30 transition hover:bg-gold-600 active:scale-[0.99]"
      >
        Buy on {platform}
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
        </svg>
      </a>
      <p className="text-sm text-muted">You&apos;ll complete the purchase on {platform}. Payment, delivery and returns are handled by them.</p>
      {product.affiliateDisclosure && (
        <p className="rounded-xl bg-gold-50 p-3 text-xs leading-relaxed text-amber-900 ring-1 ring-gold/40">{product.affiliateDisclosure}</p>
      )}
    </div>
  );
}
