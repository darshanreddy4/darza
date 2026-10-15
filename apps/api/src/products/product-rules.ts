import { ProductType } from "@prisma/client";

export interface ProductRuleInput {
  productType: ProductType;
  pricePaise: number;
  mrpPaise?: number | null;
  sku?: string | null;
  stock?: number | null;
  platform?: string | null;
  affiliateUrl?: string | null;
}

// Returns a list of human-readable problems; empty means valid.
export function validateProductRules(p: ProductRuleInput): string[] {
  const errors: string[] = [];
  if (p.mrpPaise != null && p.mrpPaise < p.pricePaise) errors.push("mrpPaise cannot be lower than pricePaise");

  if (p.productType === "OWN") {
    if (!p.sku) errors.push("OWN products require a sku");
    if (p.stock == null) errors.push("OWN products require stock");
    if (p.affiliateUrl) errors.push("OWN products cannot have an affiliateUrl");
  } else {
    if (!p.affiliateUrl) errors.push("AFFILIATE products require an affiliateUrl");
    if (!p.platform) errors.push("AFFILIATE products require a platform");
    if (p.sku || p.stock != null) errors.push("AFFILIATE products cannot have sku or stock");
  }
  return errors;
}

export const DEFAULT_AFFILIATE_DISCLOSURE =
  "Affiliate link. {brand} may earn a commission if you purchase through this link, at no extra cost to you.";
