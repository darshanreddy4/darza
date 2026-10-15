"use client";

import Link from "next/link";
import { useWishlist } from "@/lib/wishlist";

export function WishlistLink() {
  const { ids } = useWishlist();
  return (
    <Link href="/wishlist" className="relative hidden items-center rounded-xl px-3 py-2 text-white/90 hover:bg-white/10 sm:flex" aria-label={`Wishlist, ${ids.size} items`}>
      <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s-7.5-4.6-9.6-9.2C1 8.7 2.7 5 6.2 5c2 0 3.2 1.1 3.8 2.1h4C14.6 6.1 15.8 5 17.8 5c3.5 0 5.2 3.7 3.8 6.8C19.5 16.4 12 21 12 21z" />
      </svg>
      {ids.size > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">{ids.size}</span>}
    </Link>
  );
}
