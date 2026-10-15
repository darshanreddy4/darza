import { BadRequestException } from "@nestjs/common";

export const GRANULARITIES = ["hour", "day", "month"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_HOURLY_DAYS = 31;

// Dates are calendar days in India; the end date is inclusive.
export function dateRange(from?: string, to?: string, now = new Date()) {
  const end = to ? new Date(`${to}T00:00:00+05:30`) : new Date(now);
  if (to) end.setTime(end.getTime() + 86_400_000);
  const start = from ? new Date(`${from}T00:00:00+05:30`) : new Date(end.getTime() - 30 * 86_400_000);
  if ((from && !DATE.test(from)) || (to && !DATE.test(to)) || isNaN(+start) || isNaN(+end) || start >= end) {
    throw new BadRequestException("Invalid date range");
  }
  return { start, end };
}

export function parseGranularity(value: string | undefined, start: Date, end: Date): Granularity {
  const g = (value ?? "day") as Granularity;
  if (!GRANULARITIES.includes(g)) throw new BadRequestException("granularity must be hour, day or month");
  if (g === "hour" && end.getTime() - start.getTime() > MAX_HOURLY_DAYS * 86_400_000) {
    throw new BadRequestException(`Hourly charts cover at most ${MAX_HOURLY_DAYS} days`);
  }
  return g;
}

// Postgres to_char pattern for each bucket; the key is also what the web app uses to line points up.
export const BUCKET_FORMAT: Record<Granularity, string> = { hour: "YYYY-MM-DD HH24", day: "YYYY-MM-DD", month: "YYYY-MM" };

// Revenue is what customers paid for goods (after coupon discounts); profit also subtracts what the goods cost.
export function netFigures(grossPaise: number, marginPaise: number, discountPaise: number) {
  return { revenuePaise: grossPaise - discountPaise, profitPaise: marginPaise - discountPaise };
}
