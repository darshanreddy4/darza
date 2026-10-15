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
