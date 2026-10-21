"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/api";

// Sits above the card's full-card link, so clicking it adds to the cart instead of opening the product.
export function AddToCartButton({ product }: { product: Product }) {
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const out = product.inStock === false;

  // An option has to be chosen first, which happens on the product page.
  if ((product.options?.length ?? 0) > 0 && !out) {
    return <Link href={`/products/${product.slug}`} className="relative z-10 mt-1 block w-full rounded-full bg-gold px-4 py-2 text-center text-sm font-semibold text-ink transition hover:bg-gold-600">Select options</Link>;
  }

  return (
    <button
      type="button"
      disabled={out}
      onClick={() => {
        cart.add({ productId: product.id, slug: product.slug, name: product.name, image: product.images[0]?.url ?? null, pricePaise: product.pricePaise });
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
      }}
      className="relative z-10 mt-1 w-full rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:bg-gold-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
    >
      {out ? "Out of stock" : added ? "Added ✓" : "Add to cart"}
    </button>
  );
}
