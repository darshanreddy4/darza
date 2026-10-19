import { multiBuyOf } from "./multi-buy";

export const MAX_DELIVERY_DAYS = 30;

// Calendar date (YYYY-MM-DD) that is `days` from today in India, so the label doesn't depend on server or visitor time zone.
export function deliveryByDate(days: number, now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 3_600_000);
  ist.setUTCDate(ist.getUTCDate() + days);
  return ist.toISOString().slice(0, 10);
}

interface CardFields { productType: "OWN" | "AFFILIATE"; showAddToCart: boolean; deliveryDays: number | null }

// Delivery and cart only make sense for our own products; partner products are fulfilled elsewhere.
export function publicCardFields(p: CardFields, now = new Date()) {
  const own = p.productType === "OWN";
  return {
    showAddToCart: own && p.showAddToCart,
    deliveryBy: own && p.deliveryDays !== null ? deliveryByDate(p.deliveryDays, now) : null,
  };
}

export const SALE_TAGS = ["TOP_DISCOUNT", "LOWEST_PRICE"] as const;

// Orders that count as a purchase: not unpaid, cancelled or refunded.
export const SOLD_ORDER_STATUSES = ["PLACED", "PAID", "SHIPPED", "DELIVERED"] as const;

interface ExtraFields {
  productType: "OWN" | "AFFILIATE";
  stock: number | null;
  saleTag: string | null;
  showSold: boolean;
  multiBuyQty: number | null;
  multiBuyPercent: number | null;
}

// "Only few left" and the units-bought count come from real stock and orders; the exact stock is never sent out.
export function publicExtraFields(p: ExtraFields, lowStockThreshold: number, unitsSold: number) {
  const own = p.productType === "OWN";
  return {
    saleTag: (SALE_TAGS as readonly string[]).includes(p.saleTag ?? "") ? p.saleTag : null,
    lowStock: own && p.stock !== null && p.stock > 0 && p.stock <= lowStockThreshold,
    soldCount: own && p.showSold ? Math.max(0, unitsSold) : 0,
    multiBuy: multiBuyOf(p),
  };
}
