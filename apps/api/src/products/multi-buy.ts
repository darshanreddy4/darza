export interface MultiBuy { qty: number; percent: number }

export const MULTI_BUY_QTY = { min: 2, max: 10 } as const;
export const MULTI_BUY_PERCENT = { min: 1, max: 50 } as const;

// The offer a product carries, or null when it has none. Only our own products can have one.
export function multiBuyOf(p: { productType: "OWN" | "AFFILIATE"; multiBuyQty: number | null; multiBuyPercent: number | null }): MultiBuy | null {
  if (p.productType !== "OWN" || p.multiBuyQty === null || p.multiBuyPercent === null) return null;
  return { qty: p.multiBuyQty, percent: p.multiBuyPercent };
}

// What one basket line costs. The saving is built into the unit price, so invoices, returns and reports all agree with the total.
export function priceLine(pricePaise: number, quantity: number, offer: MultiBuy | null) {
  const applied = !!offer && quantity >= offer.qty;
  const unitPaise = applied ? Math.round((pricePaise * (100 - offer.percent)) / 100) : pricePaise;
  return {
    unitPaise,
    savedPaise: (pricePaise - unitPaise) * quantity,
    // Shown in the cart while the customer is one step away from the offer.
    buyMoreFor: offer && !applied ? offer : null,
  };
}
