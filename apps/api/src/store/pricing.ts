export interface ShippingRule {
  shippingFeePaise: number;
  // Null means delivery is never free.
  freeShippingOverPaise: number | null;
}

// The threshold is measured on what the customer pays for goods, after any coupon discount.
export function shippingFor(goodsPaise: number, rule: ShippingRule): number {
  if (rule.shippingFeePaise <= 0) return 0;
  if (rule.freeShippingOverPaise !== null && goodsPaise >= rule.freeShippingOverPaise) return 0;
  return rule.shippingFeePaise;
}

export function computeTotals(subtotalPaise: number, discountPaise: number, rule: ShippingRule) {
  const discount = Math.min(Math.max(0, discountPaise), subtotalPaise);
  const goods = subtotalPaise - discount;
  const shippingPaise = subtotalPaise === 0 ? 0 : shippingFor(goods, rule);
  const gap = shippingPaise > 0 && rule.freeShippingOverPaise !== null ? Math.max(0, rule.freeShippingOverPaise - goods) : 0;
  return { subtotalPaise, discountPaise: discount, shippingPaise, totalPaise: goods + shippingPaise, freeShippingGapPaise: gap };
}
