// Part payment: a share of the order is paid online first and the rest when it is delivered.

export interface PayLine { name: string; onlineOnly: boolean; advancePercent: number | null }

export interface AdvanceOffer {
  available: boolean;
  reason: string | null;
  // The share paid now: the highest share asked for by any product in the basket.
  percent: number;
  payNowPaise: number;
  balancePaise: number;
}

// "A and B", or "A, B and 2 more".
export function listNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

export const onlineOnlyNames = (lines: PayLine[]) => lines.filter((l) => l.onlineOnly).map((l) => l.name);

// Products sold with part payment (while the store offers it): paying everything in cash on delivery is not one of their choices.
export const advanceNames = (enabled: boolean, lines: PayLine[]) => (enabled ? lines.filter((l) => !l.onlineOnly && l.advancePercent).map((l) => l.name) : []);

const none = (reason: string): AdvanceOffer => ({ available: false, reason, percent: 0, payNowPaise: 0, balancePaise: 0 });

// Part payment needs the store switch on and every product in the basket to offer it; totalPaise is what the order costs in all.
export function advanceFor(enabled: boolean, lines: PayLine[], totalPaise: number): AdvanceOffer {
  if (!enabled) return none("Part payment isn't offered.");
  if (lines.length === 0 || totalPaise <= 0) return none("Your basket is empty.");
  const blocked = lines.filter((l) => l.onlineOnly || !l.advancePercent).map((l) => l.name);
  if (blocked.length) return none(`Part payment isn't available for ${listNames(blocked)}.`);
  const percent = Math.max(...lines.map((l) => l.advancePercent!));
  const payNowPaise = Math.min(totalPaise, Math.max(1, Math.ceil((totalPaise * percent) / 100)));
  return { available: true, reason: null, percent, payNowPaise, balancePaise: totalPaise - payNowPaise };
}
