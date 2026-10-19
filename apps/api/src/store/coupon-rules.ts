export interface CouponLike {
  type: "PERCENT" | "FLAT";
  value: number;
  minOrderPaise: number;
  maxDiscountPaise: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  active: boolean;
  // Chosen customers: when the list has anyone in it, only they can use the code.
  customerIds?: string[];
  firstOrderOnly?: boolean;
}

export interface CouponContext {
  subtotalPaise: number;
  now: Date;
  // Orders already using the code (cancelled and refunded ones don't count).
  usedTotal: number;
  usedByUser?: number;
  // Uses by anyone with the same account, email address or phone number, so a second account does not get a second use.
  usedByIdentity?: number;
  // Who is asking; unknown for a signed-out visitor.
  userId?: string;
  // Orders this person has already placed under the same identity (cancelled and refunded ones do not count).
  ordersBefore?: number;
}

export type CouponResult = { ok: true; discountPaise: number } | { ok: false; reason: string };

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function evaluateCoupon(c: CouponLike, ctx: CouponContext): CouponResult {
  if (!c.active) return { ok: false, reason: "This code is not active" };
  const chosen = c.customerIds ?? [];
  if (chosen.length > 0 && !ctx.userId) return { ok: false, reason: "Log in to use this code" };
  if (chosen.length > 0 && !chosen.includes(ctx.userId!)) return { ok: false, reason: "This code is not valid for your account" };
  if (c.firstOrderOnly && (ctx.ordersBefore ?? 0) > 0) return { ok: false, reason: "This code is for your first order only" };
  if (c.startsAt && c.startsAt > ctx.now) return { ok: false, reason: "This code is not valid yet" };
  if (c.endsAt && c.endsAt <= ctx.now) return { ok: false, reason: "This code has expired" };
  if (c.usageLimit !== null && ctx.usedTotal >= c.usageLimit) return { ok: false, reason: "This code has reached its usage limit" };
  if (c.perUserLimit !== null && (ctx.usedByUser ?? 0) >= c.perUserLimit) return { ok: false, reason: "You have already used this code" };
  if (c.perUserLimit !== null && (ctx.usedByIdentity ?? 0) >= c.perUserLimit) return { ok: false, reason: "This code has already been used with your email address or mobile number" };
  if (ctx.subtotalPaise < c.minOrderPaise) return { ok: false, reason: `Add ${rupees(c.minOrderPaise - ctx.subtotalPaise)} more to use this code (minimum order ${rupees(c.minOrderPaise)})` };

  let discount = c.type === "PERCENT" ? Math.floor((ctx.subtotalPaise * c.value) / 100) : c.value;
  if (c.maxDiscountPaise !== null) discount = Math.min(discount, c.maxDiscountPaise);
  discount = Math.min(discount, ctx.subtotalPaise);
  if (discount <= 0) return { ok: false, reason: "This code gives no discount on your cart" };
  return { ok: true, discountPaise: discount };
}

export const normalizeCouponCode = (code: string) => code.trim().toUpperCase();

// "10% off (up to ₹200)" or "₹50 off", as shown to customers.
export function offerText(c: { type: "PERCENT" | "FLAT"; value: number; maxDiscountPaise: number | null }): string {
  return c.type === "PERCENT" ? `${c.value}% off${c.maxDiscountPaise ? ` (up to ${rupees(c.maxDiscountPaise)})` : ""}` : `${rupees(c.value)} off`;
}
