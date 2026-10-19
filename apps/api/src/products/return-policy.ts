// Wording an admin might type in the returns box to say a product cannot be sent back: "No return", "Non-returnable", "Not eligible for returns"...
const NO_RETURN = /\b(?:no|non)[\s-]*(?:returns?|refunds?|returnable)\b|\bnot[\s-]+(?:eligible[\s-]+for[\s-]+)?(?:returns?|returnable|refund(?:able)?)\b/i;

export const textSaysNoReturn = (text: string | null | undefined) => !!text && NO_RETURN.test(text);

// Days a customer has to return a product after delivery; 0 means it cannot be returned.
// The product's own setting wins, then what its returns text says, then the store's window. Partner products are not ours to take back.
export function productReturnDays(p: { productType: "OWN" | "AFFILIATE"; returnDays: number | null; returnPolicy: string | null }, storeDays: number): number {
  if (p.productType !== "OWN") return 0;
  if (p.returnDays !== null) return p.returnDays;
  return textSaysNoReturn(p.returnPolicy) ? 0 : Math.max(0, storeDays);
}
