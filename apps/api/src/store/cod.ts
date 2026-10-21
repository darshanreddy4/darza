// Pay on delivery: whether an order may use it and what it costs on top.
import { listNames } from "./advance";

export interface CodRules { enabled: boolean; feePaise: number; maxOrderPaise: number | null }

export interface CodVerdict { allowed: boolean; feePaise: number; reason: string | null }

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const codRulesOf = (s: { codEnabled: boolean; codFeePaise: number; codMaxOrderPaise: number | null }): CodRules => ({ enabled: s.codEnabled, feePaise: s.codFeePaise, maxOrderPaise: s.codMaxOrderPaise });

// orderPaise is what the customer would pay before the pay-on-delivery fee. onlineOnly names the products in the basket that must be paid for online, and needsAdvance
// those sold with part payment, which need some of the money online first.
export function codFor(rules: CodRules, orderPaise: number, onlineOnly: string[] = [], needsAdvance: string[] = []): CodVerdict {
  if (onlineOnly.length) return { allowed: false, feePaise: 0, reason: `${listNames(onlineOnly)} can only be paid for online.` };
  if (needsAdvance.length) return { allowed: false, feePaise: 0, reason: `${listNames(needsAdvance)} needs part of the payment online first. Choose part payment or pay online.` };
  if (!rules.enabled) return { allowed: false, feePaise: 0, reason: "Pay on delivery isn't available. Please pay online." };
  if (rules.maxOrderPaise !== null && orderPaise > rules.maxOrderPaise) {
    return { allowed: false, feePaise: 0, reason: `Pay on delivery is available for orders up to ${inr(rules.maxOrderPaise)}. Please pay online.` };
  }
  return { allowed: true, feePaise: rules.feePaise, reason: null };
}
