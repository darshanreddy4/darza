"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { API_URL } from "@/lib/api";
import type { CartLine } from "@/lib/cart";

export interface Quote {
  subtotalPaise: number; discountPaise: number; shippingPaise: number; totalPaise: number; freeShippingGapPaise: number;
  coupon: { code: string; description: string | null } | null; couponError: string | null; unavailable: string[];
}

const KEY = "dmg-coupon";
const CHANGE = "dmg-coupon-change";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(CHANGE, cb);
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(CHANGE, cb); };
};

// The coupon code is kept between the cart and checkout pages.
export function useCouponCode(): [string, (code: string) => void] {
  const code = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY) ?? "", () => "");
  const set = (next: string) => {
    if (next) localStorage.setItem(KEY, next); else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(CHANGE));
  };
  return [code, set];
}

// Asks the server to price the basket so delivery fees, coupons and totals always match what will be charged.
export function useQuote(lines: CartLine[], couponCode: string) {
  const items = useMemo(() => lines.map((l) => ({ productId: l.productId, quantity: l.quantity })), [lines]);
  const key = JSON.stringify({ items, couponCode });
  const [state, setState] = useState<{ key: string; quote: Quote | null }>({ key: "", quote: null });

  useEffect(() => {
    if (items.length === 0) return;
    let stale = false;
    const t = setTimeout(() => {
      fetch(`${API_URL}/checkout/quote`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ items, couponCode: couponCode || undefined }) })
        .then((r) => (r.ok ? (r.json() as Promise<Quote>) : null))
        .then((quote) => { if (!stale) setState({ key, quote }); })
        .catch(() => { if (!stale) setState({ key, quote: null }); });
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [key, items, couponCode]);

  // The previous answer stays on screen while a new one loads, so totals don't flicker.
  return { quote: state.quote, loading: state.key !== key };
}
