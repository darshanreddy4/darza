"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { API_URL, type Product } from "@/lib/api";
import { NotifyMe } from "./NotifyMe";

export function PurchaseActions({ product }: { product: Product }) {
  const cart = useCart();
  const [added, setAdded] = useState(false);

  if (product.productType === "OWN") {
    return (
      <div className="space-y-3">
        <button
          disabled={!product.inStock}
          onClick={() => {
            cart.add({
              productId: product.id,
              slug: product.slug,
              name: product.name,
              image: product.images[0]?.url ?? null,
              pricePaise: product.pricePaise,
            });
            setAdded(true);
          }}
          className="w-full rounded-xl bg-brand-500 px-6 py-3.5 font-semibold text-ink shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-line disabled:text-muted disabled:shadow-none"
        >
          {!product.inStock ? "Out of stock" : added ? "Added to cart ✓ — add another" : "Add to Cart"}
        </button>
        {!product.inStock && <NotifyMe slug={product.slug} />}
        {added && (
          <Link href="/cart" className="block w-full rounded-xl border border-ink px-6 py-3 text-center font-semibold hover:bg-ink hover:text-white">
            Go to cart
          </Link>
        )}
        <p className="flex items-center gap-2 text-sm text-muted">
          <span className="h-2 w-2 rounded-full bg-brand-500" /> Sold and fulfilled by {product.sellerName}
        </p>
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
