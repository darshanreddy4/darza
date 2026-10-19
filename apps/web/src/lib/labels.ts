// Short labels shown on product cards and pages.
import { formatPrice, type Product } from "@/lib/api";

export type RatingTone = "good" | "fair" | "poor";

// Green for well rated, amber for middling, red for poorly rated.
export const ratingTone = (avg: number): RatingTone => (avg >= 3.5 ? "good" : avg >= 2.5 ? "fair" : "poor");

// "37 bought", "1.2K+ bought". Rounded down, so the number is never overstated.
export function soldText(n: number): string {
  if (n < 1000) return `${n} bought`;
  const k = n / 1000;
  const whole = k >= 10 ? String(Math.floor(k)) : String(Math.floor(k * 10) / 10);
  return `${whole}K+ bought`;
}

export const multiBuyText = (m: { qty: number; percent: number }) => `Buy ${m.qty} items, save extra ${m.percent}%`;

export const SALE_TAG_TEXT = { TOP_DISCOUNT: "Top Discount of the Sale", LOWEST_PRICE: "Lowest price in the year" } as const;
export type SaleTag = keyof typeof SALE_TAG_TEXT;

// One word for an average rating, shown next to the number.
export const ratingWord = (avg: number) => (avg >= 4.5 ? "Excellent" : avg >= 4 ? "Very Good" : avg >= 3 ? "Good" : avg >= 2 ? "Fair" : "Poor");

// Milliseconds from now until an ISO time; negative once it has passed.
export const msUntil = (iso: string) => Date.parse(iso) - Date.now();

// The store-wide delivery rules, as the shop publishes them.
export interface StoreDelivery { shippingFeePaise: number; freeShippingOverPaise: number | null; freeAllOverPaise: number | null }

// A sentence on what delivering this product costs under the given rules (the store's, or those of the shopper's area).
export function deliveryDetail(p: Pick<Product, "freeDelivery" | "chargeDelivery" | "deliveryFeePaise">, s: StoreDelivery): string {
  const everything = s.freeAllOverPaise !== null ? ` Everything ships free on orders of ${formatPrice(s.freeAllOverPaise)} or more.` : "";
  if (p.freeDelivery) return "No delivery charge for this item.";
  if (p.chargeDelivery) {
    const fee = p.deliveryFeePaise ?? s.shippingFeePaise;
    return fee === 0 ? "No delivery charge for this item." : `Delivery charge ${formatPrice(fee)} for this item.${everything}`;
  }
  if (s.shippingFeePaise === 0) return "No delivery charge.";
  if (s.freeShippingOverPaise !== null) return `Delivery ${formatPrice(s.shippingFeePaise)}, free on orders of ${formatPrice(s.freeShippingOverPaise)} or more.${s.freeAllOverPaise !== null && s.freeAllOverPaise > s.freeShippingOverPaise ? everything : ""}`;
  return `Delivery ${formatPrice(s.shippingFeePaise)}.${everything}`;
}

// What to tell a shopper about delivery cost for one product, from the product's own setting first and then the store's rules.
export function deliveryLabel(p: Pick<Product, "freeDelivery" | "chargeDelivery" | "deliveryFeePaise">, store: StoreDelivery | null): { text: string; free: boolean } | null {
  if (p.freeDelivery) return { text: "Free delivery", free: true };
  if (p.chargeDelivery) {
    const fee = p.deliveryFeePaise ?? store?.shippingFeePaise ?? null;
    if (fee === null) return { text: "Delivery charge applies", free: false };
    return fee === 0 ? { text: "Free delivery", free: true } : { text: `Delivery ${formatPrice(fee)}`, free: false };
  }
  if (!store) return null;
  if (store.shippingFeePaise === 0) return { text: "Free delivery", free: true };
  return store.freeShippingOverPaise !== null ? { text: `Free delivery over ${formatPrice(store.freeShippingOverPaise)}`, free: true } : { text: `Delivery ${formatPrice(store.shippingFeePaise)}`, free: false };
}
