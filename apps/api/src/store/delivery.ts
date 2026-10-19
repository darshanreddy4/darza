// STORE follows the store's delivery rules, FREE never pays delivery, CHARGE always pays its own delivery (heavy or bulky goods).
export type DeliveryMode = "STORE" | "FREE" | "CHARGE";

export interface DeliveryLine {
  goodsPaise: number;
  mode: DeliveryMode;
  // What a CHARGE line pays; null means the store's (or the area's) delivery fee.
  feePaise: number | null;
}

// An area picked out by the start of its PIN codes ("79" is every PIN code beginning 79) with its own fee.
export interface DeliveryZone {
  name: string;
  pincodes: string[];
  feePaise: number;
  // Null means regular items are never free to this area.
  freeOverPaise: number | null;
}

// A reward on the progress bar: a free gift (the default), or a percentage off the whole order (kind PERCENT, up to maxPaise).
export interface GiftTier { atPaise: number; title: string; kind?: "PERCENT"; percent?: number; maxPaise?: number }

export interface DeliveryRules {
  shippingFeePaise: number;
  // Null means regular items are never free.
  freeShippingOverPaise: number | null;
  // When the whole basket reaches this, every delivery charge is waived. Null turns it off.
  freeAllOverPaise: number | null;
}

export const DEFAULT_RULES: DeliveryRules = { shippingFeePaise: 0, freeShippingOverPaise: null, freeAllOverPaise: null };

export const deliveryModeOf = (p: { freeDelivery: boolean; chargeDelivery: boolean }): DeliveryMode => (p.chargeDelivery ? "CHARGE" : p.freeDelivery ? "FREE" : "STORE");

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const whole = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);

// The zones and gifts live in JSON columns; anything malformed is ignored rather than breaking checkout.
export function parseZones(json: unknown): DeliveryZone[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((z): DeliveryZone[] => {
    if (!isRecord(z) || typeof z.name !== "string" || !Array.isArray(z.pincodes)) return [];
    const feePaise = whole(z.feePaise);
    if (feePaise === null) return [];
    return [{ name: z.name, pincodes: z.pincodes.filter((p): p is string => typeof p === "string" && /^[1-9]\d{0,5}$/.test(p)), feePaise, freeOverPaise: whole(z.freeOverPaise) }];
  });
}

export function parseGifts(json: unknown): GiftTier[] {
  if (!Array.isArray(json)) return [];
  return json
    .flatMap((g): GiftTier[] => {
      if (!isRecord(g) || typeof g.title !== "string" || !whole(g.atPaise)) return [];
      const atPaise = g.atPaise as number;
      if (g.kind !== "PERCENT") return [{ atPaise, title: g.title }];
      const percent = whole(g.percent);
      if (!percent || percent > 90) return [];
      const maxPaise = whole(g.maxPaise);
      return [{ atPaise, title: g.title, kind: "PERCENT", percent, ...(maxPaise ? { maxPaise } : {}) }];
    })
    .sort((a, b) => a.atPaise - b.atPaise);
}

// The best percentage reward the cart value has reached (they do not add up), as an amount off the goods.
export function rewardDiscountFor(subtotalPaise: number, tiers: GiftTier[]): { paise: number; title: string } | null {
  let best: { paise: number; title: string } | null = null;
  for (const t of tiers) {
    if (t.kind !== "PERCENT" || !t.percent || subtotalPaise < t.atPaise) continue;
    let paise = Math.floor((subtotalPaise * t.percent) / 100);
    if (t.maxPaise) paise = Math.min(paise, t.maxPaise);
    if (paise > (best?.paise ?? 0)) best = { paise, title: t.title };
  }
  return best;
}

// The zone with the longest matching PIN code start wins; with a tie the one listed first.
export function zoneFor(zones: DeliveryZone[], pincode?: string | null): DeliveryZone | null {
  if (!pincode || !/^[1-9]\d{5}$/.test(pincode)) return null;
  let best: DeliveryZone | null = null;
  let bestLen = 0;
  for (const z of zones) {
    for (const p of z.pincodes) {
      if (pincode.startsWith(p) && p.length > bestLen) { best = z; bestLen = p.length; }
    }
  }
  return best;
}

export interface Milestone {
  kind: "delivery" | "delivery-all" | "gift" | "discount" | "coupon";
  title: string;
  atPaise: number;
  reached: boolean;
}

export function priceBasket(input: { lines: DeliveryLine[]; discountPaise: number; rules: DeliveryRules; zone?: DeliveryZone | null; gifts?: GiftTier[]; coupons?: { title: string; atPaise: number; reached: boolean }[] }) {
  const { lines, rules } = input;
  const zone = input.zone ?? null;
  const subtotalPaise = lines.reduce((n, l) => n + l.goodsPaise, 0);
  // A percentage reward comes off first; the coupon then works on what is left.
  const reward = rewardDiscountFor(subtotalPaise, input.gifts ?? []);
  const rewardDiscountPaise = Math.min(reward?.paise ?? 0, subtotalPaise);
  const discountPaise = Math.min(Math.max(0, input.discountPaise), subtotalPaise - rewardDiscountPaise);
  const goodsPaise = subtotalPaise - rewardDiscountPaise - discountPaise;
  // Free-delivery and gift amounts are measured on the cart value before a coupon, as on the big marketplaces:
  // a coupon lowers what is paid, not what was bought.
  const basisPaise = subtotalPaise;

  const feePaise = zone ? zone.feePaise : rules.shippingFeePaise;
  const freeOverPaise = zone ? zone.freeOverPaise : rules.freeShippingOverPaise;
  const hasRegular = lines.some((l) => l.mode === "STORE");
  const hasSpecial = lines.some((l) => l.mode === "CHARGE");

  const regularRaw = hasRegular ? feePaise : 0;
  const specialRaw = lines.reduce((n, l) => (l.mode === "CHARGE" ? n + (l.feePaise ?? feePaise) : n), 0);
  const regularPaise = regularRaw > 0 && freeOverPaise !== null && basisPaise >= freeOverPaise ? 0 : regularRaw;
  const freeAll = rules.freeAllOverPaise !== null && basisPaise >= rules.freeAllOverPaise && regularPaise + specialRaw > 0;
  const standardPaise = freeAll ? 0 : regularPaise;
  const specialPaise = freeAll ? 0 : specialRaw;
  const shippingPaise = subtotalPaise === 0 ? 0 : standardPaise + specialPaise;

  const regularGap = shippingPaise > 0 && standardPaise > 0 && freeOverPaise !== null ? Math.max(0, freeOverPaise - basisPaise) : 0;
  const freeAllGap = shippingPaise > 0 && rules.freeAllOverPaise !== null ? Math.max(0, rules.freeAllOverPaise - basisPaise) : 0;

  const milestones: Milestone[] = [];
  const hasFreeLine = regularRaw > 0 && freeOverPaise !== null;
  if (subtotalPaise > 0 && hasFreeLine) {
    milestones.push({ kind: "delivery", title: hasSpecial ? "Free delivery on your other items" : "Free delivery", reached: basisPaise >= freeOverPaise, atPaise: freeOverPaise });
  }
  // A basket with no heavy items that already unlocks free delivery at a lower amount gains nothing from the higher one.
  if (subtotalPaise > 0 && rules.freeAllOverPaise !== null && regularRaw + specialRaw > 0 && !(hasFreeLine && !hasSpecial && freeOverPaise !== null && freeOverPaise <= rules.freeAllOverPaise)) {
    milestones.push({ kind: "delivery-all", title: hasSpecial ? "Free delivery on everything" : "Free delivery", reached: basisPaise >= rules.freeAllOverPaise, atPaise: rules.freeAllOverPaise });
  }
  for (const g of input.gifts ?? []) {
    if (subtotalPaise > 0) milestones.push({ kind: g.kind === "PERCENT" ? "discount" : "gift", title: g.title, reached: basisPaise >= g.atPaise, atPaise: g.atPaise });
  }
  // Codes the shopper can unlock by spending more sit on the same bar; whether one is unlocked is decided by the coupon rules.
  for (const c of input.coupons ?? []) {
    if (subtotalPaise > 0) milestones.push({ kind: "coupon", title: c.title, reached: c.reached, atPaise: c.atPaise });
  }
  milestones.sort((a, b) => a.atPaise - b.atPaise);
  const next = milestones.find((m) => !m.reached);

  return {
    subtotalPaise, discountPaise, rewardDiscountPaise, rewardTitle: reward?.title ?? null, shippingPaise, totalPaise: goodsPaise + shippingPaise, freeShippingGapPaise: regularGap,
    delivery: {
      standardPaise, specialPaise, hasRegular, hasSpecial, zone: zone?.name ?? null, freeAllGapPaise: freeAllGap,
      freeBecause: shippingPaise > 0 || regularRaw + specialRaw === 0 ? null : freeAll ? ("ALL" as const) : ("THRESHOLD" as const),
    },
    rewards: { goodsPaise: basisPaise, milestones, next: next ? { title: next.title, remainingPaise: next.atPaise - basisPaise } : null },
    earnedGifts: (input.gifts ?? []).filter((g) => g.kind !== "PERCENT" && subtotalPaise > 0 && basisPaise >= g.atPaise).map((g) => g.title),
  };
}
