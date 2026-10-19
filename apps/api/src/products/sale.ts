interface SaleFields {
  productType: "OWN" | "AFFILIATE";
  pricePaise: number;
  salePricePaise: number | null;
  saleEndsAt: Date | null;
}

// The running sale, or null. A sale is only real while its end time is ahead and its price is under the normal price.
export function activeSale(p: SaleFields, now = new Date()): { pricePaise: number; endsAt: Date } | null {
  if (p.productType !== "OWN" || p.salePricePaise === null || p.saleEndsAt === null) return null;
  if (p.saleEndsAt.getTime() <= now.getTime() || p.salePricePaise >= p.pricePaise) return null;
  return { pricePaise: p.salePricePaise, endsAt: p.saleEndsAt };
}

// What a customer pays right now for one unit, before any multi-buy saving.
export const sellingPrice = (p: SaleFields, now = new Date()) => activeSale(p, now)?.pricePaise ?? p.pricePaise;

// Problems with a sale as typed in the admin; empty means fine.
export function validateSale(p: { pricePaise: number; salePricePaise?: number | null; saleEndsAt?: Date | null }): string[] {
  if ((p.salePricePaise == null) !== (p.saleEndsAt == null)) return ["A timed sale needs both a sale price and an end time"];
  if (p.salePricePaise != null && p.salePricePaise >= p.pricePaise) return ["The sale price must be lower than the selling price"];
  return [];
}
