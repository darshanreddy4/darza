"use client";

import { useWishlist } from "@/lib/wishlist";

export function WishlistButton({ productId, className = "", label = false }: { productId: string; className?: string; label?: boolean }) {
  const { has, toggle } = useWishlist();
  const active = has(productId);
  return (
    <button
      type="button"
      onClick={() => toggle(productId)}
      aria-pressed={active}
      aria-label={label ? undefined : active ? "Remove from wishlist" : "Add to wishlist"}
      className={`inline-flex items-center justify-center gap-2 rounded-full transition ${active ? "text-rose-600" : "text-ink-3 hover:text-rose-600"} ${className}`}
    >
      <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s-7.5-4.6-9.6-9.2C1 8.7 2.7 5 6.2 5c2 0 3.2 1.1 3.8 2.1h4C14.6 6.1 15.8 5 17.8 5c3.5 0 5.2 3.7 3.8 6.8C19.5 16.4 12 21 12 21z" />
      </svg>
      {label && <span className="text-sm font-medium">{active ? "Saved to wishlist" : "Save to wishlist"}</span>}
    </button>
  );
}
