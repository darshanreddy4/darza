// Guest checkout: a shopper who gave only a verified mobile number pays online, or pays the delivery charge online and the rest in cash on delivery.
import type { CodVerdict } from "./cod";

export interface GuestRules { checkoutEnabled: boolean; codEnabled: boolean; minAdvancePaise: number }

export const guestRulesOf = (s: { guestCheckoutEnabled: boolean; guestCodEnabled: boolean; guestMinAdvancePaise: number }): GuestRules => ({
  checkoutEnabled: s.guestCheckoutEnabled, codEnabled: s.guestCodEnabled, minAdvancePaise: s.guestMinAdvancePaise,
});

export interface GuestOffer {
  allowed: boolean;
  reason: string | null;
  // Paid online now: the delivery charge and any pay-on-delivery fee, at least the store's minimum.
  advancePaise: number;
  // Paid in cash when the order arrives, and included in the order total.
  balancePaise: number;
  // What the order costs in all, with the pay-on-delivery fee.
  totalPaise: number;
}

const refused = (reason: string): GuestOffer => ({ allowed: false, reason, advancePaise: 0, balancePaise: 0, totalPaise: 0 });

export interface GuestInput {
  rules: GuestRules;
  // Pay on delivery as the shop's own rules see this basket (order size limit, products sold online only).
  cod: CodVerdict;
  // The delivery charge alone, before any pay-on-delivery fee.
  deliveryPaise: number;
  // Goods less discounts plus the delivery charge, before the pay-on-delivery fee.
  orderPaise: number;
  // The largest part-payment share a product in the basket asks for, if any.
  productPercent: number;
}

// The cash-on-delivery choice for a guest. The delivery charge (and the fee for paying cash) goes online now, so a refused parcel costs the shop nothing.
export function guestDeliveryAdvance(i: GuestInput): GuestOffer {
  if (!i.rules.codEnabled) return refused("Cash on delivery isn't offered to guests. Please pay online.");
  if (!i.cod.allowed) return refused(i.cod.reason ?? "Cash on delivery isn't available for this order. Please pay online.");
  if (i.orderPaise <= 0) return refused("Your basket is empty.");
  const totalPaise = i.orderPaise + i.cod.feePaise;
  const share = i.productPercent > 0 ? Math.ceil((totalPaise * i.productPercent) / 100) : 0;
  const advancePaise = Math.max(i.deliveryPaise + i.cod.feePaise, i.rules.minAdvancePaise, share);
  if (advancePaise >= totalPaise) return refused("There would be nothing left to pay on delivery, so please pay the full amount online.");
  return { allowed: true, reason: null, advancePaise, balancePaise: totalPaise - advancePaise, totalPaise };
}

export const GUEST_COD_REASON = "Guests pay online. Pay in full now, or pay the delivery charge now and the rest on delivery.";

// The biggest share a product in the basket asks to be paid online first; 0 when there is none or the store has part payment off.
export function guestShare(advanceEnabled: boolean, lines: { onlineOnly: boolean; advancePercent: number | null }[]): number {
  if (!advanceEnabled) return 0;
  return Math.max(0, ...lines.filter((l) => !l.onlineOnly && l.advancePercent).map((l) => l.advancePercent!));
}
