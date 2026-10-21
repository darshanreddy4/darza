"use client";

import { useEffect, useRef } from "react";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";

// Tells the server what a signed-in customer has in their cart, so a reminder can be emailed if they never check out.
export function CartSync() {
  const { user } = useAuth();
  const { lines } = useCart();
  const userId = user?.id;
  const signature = JSON.stringify(lines.map((l) => [l.productId, l.optionId ?? "", l.quantity]).sort());
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) { last.current = null; return; }
    const flag = `dmg-cart-sync-${userId}`;
    if (last.current === null) {
      last.current = signature;
      // On arrival, report a non-empty cart once per browser session; after that only changes count.
      if (signature === "[]" || sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, "1");
    } else if (signature === last.current) return;
    else last.current = signature;

    const timer = setTimeout(() => {
      fetch(`${API_URL}/cart/snapshot`, {
        method: "PUT", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: lines.map((l) => ({ productId: l.productId, optionId: l.optionId, quantity: l.quantity })) }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [userId, signature, lines]);

  return null;
}
