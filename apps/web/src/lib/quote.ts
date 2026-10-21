"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { API_URL } from "@/lib/api";
import type { CartLine } from "@/lib/cart";

export interface Quote {
  subtotalPaise: number; discountPaise: number; shippingPaise: number; totalPaise: number; freeShippingGapPaise: number;
  // A percentage reward earned on the progress bar, taken off before any coupon.
  rewardDiscountPaise: number; rewardTitle: string | null;
  coupon: { code: string; description: string | null } | null; couponError: string | null; unavailable: string[];
  // Codes this shopper can use or is close to unlocking.
  offers: Offer[];
  // The multi-buy saving is already inside subtotalPaise; lines say what each product costs after it.
  multiBuySavedPaise: number;
  lines: { productId: string; optionId: string | null; unitPaise: number; savedPaise: number; returnDays: number; buyMoreFor: { qty: number; percent: number } | null }[];
  delivery: {
    standardPaise: number; specialPaise: number; hasRegular: boolean; hasSpecial: boolean; zone: string | null; freeAllGapPaise: number;
    // Why delivery costs nothing when it could have: the order reached the free-delivery amount, or the free-everything amount.
    freeBecause: "ALL" | "THRESHOLD" | null;
  };
  rewards: { goodsPaise: number; milestones: Milestone[]; next: { title: string; remainingPaise: number } | null };
  // Free gifts this basket has earned.
  earnedGifts: string[];
}

export interface Milestone { kind: "delivery" | "delivery-all" | "gift" | "discount" | "coupon"; title: string; atPaise: number; reached: boolean }

// A code the shopper can use on this cart (unlocked) or soon will (locked until the minimum order is reached).
export interface Offer {
  code: string; description: string | null; type: "PERCENT" | "FLAT"; value: number; minOrderPaise: number; maxDiscountPaise: number | null; endsAt: string | null;
  unlocked: boolean; discountPaise: number; remainingPaise: number;
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
// The PIN code (once it is known) lets area delivery fees count.
export function useQuote(lines: CartLine[], couponCode: string, pincode?: string) {
  const items = useMemo(() => lines.map((l) => ({ productId: l.productId, optionId: l.optionId, quantity: l.quantity })), [lines]);
  const key = JSON.stringify({ items, couponCode, pincode });
  const [state, setState] = useState<{ key: string; quote: Quote | null }>({ key: "", quote: null });

  useEffect(() => {
    if (items.length === 0) return;
    let stale = false;
    const t = setTimeout(() => {
      fetch(`${API_URL}/checkout/quote`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ items, couponCode: couponCode || undefined, pincode: pincode || undefined }) })
        .then((r) => (r.ok ? (r.json() as Promise<Quote>) : null))
        .then((quote) => { if (!stale) setState({ key, quote }); })
        .catch(() => { if (!stale) setState({ key, quote: null }); });
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [key, items, couponCode, pincode]);

  // The previous answer stays on screen while a new one loads, so totals don't flicker.
  return { quote: state.quote, loading: state.key !== key };
}
