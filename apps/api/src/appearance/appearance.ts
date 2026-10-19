export const BASE_CURRENCY = "INR";

// Currencies the admin can offer. Prices are always stored and charged in rupees; these are for viewing only.
export const SUPPORTED_CURRENCIES = [
  { code: "USD", name: "US dollar" }, { code: "EUR", name: "Euro" }, { code: "GBP", name: "British pound" },
  { code: "AED", name: "UAE dirham" }, { code: "SAR", name: "Saudi riyal" }, { code: "QAR", name: "Qatari riyal" },
  { code: "KWD", name: "Kuwaiti dinar" }, { code: "SGD", name: "Singapore dollar" }, { code: "AUD", name: "Australian dollar" },
  { code: "CAD", name: "Canadian dollar" }, { code: "NZD", name: "New Zealand dollar" }, { code: "JPY", name: "Japanese yen" },
  { code: "CNY", name: "Chinese yuan" }, { code: "HKD", name: "Hong Kong dollar" }, { code: "CHF", name: "Swiss franc" },
  { code: "MYR", name: "Malaysian ringgit" }, { code: "THB", name: "Thai baht" }, { code: "ZAR", name: "South African rand" },
  { code: "BDT", name: "Bangladeshi taka" }, { code: "LKR", name: "Sri Lankan rupee" }, { code: "NPR", name: "Nepalese rupee" },
] as const;

export const CURRENCY_CODES: string[] = SUPPORTED_CURRENCIES.map((c) => c.code);
export const MAX_CURRENCIES = 12;

export const THEMES = [
  { key: "DEFAULT", name: "Default", blurb: "The original look of the store." },
  { key: "MINIMAL", name: "Minimalism", blurb: "Plenty of white space, thin lines, no shadows, black and white." },
  { key: "MAXIMAL", name: "Maximalism", blurb: "Loud colour, thick outlines, hard shadows and big shapes." },
  { key: "GLASS", name: "Glassmorphism", blurb: "Frosted translucent cards over a soft gradient." },
  { key: "NEUMORPHIC", name: "Neumorphism", blurb: "Soft, raised and pressed shapes in a single calm colour." },
  { key: "FLAT", name: "Flat design", blurb: "Solid bright colours, sharp corners, no shadows." },
  { key: "MATERIAL", name: "Material design", blurb: "Layered cards with elevation shadows and an indigo accent." },
  { key: "EDITORIAL", name: "Editorial", blurb: "Serif headlines, paper tones and hairline rules, like a magazine." },
] as const;

export const THEME_KEYS: string[] = THEMES.map((t) => t.key);

// Stored as { auto: { USD: units per 1 INR }, manual: { ... } }; manual wins when present.
export interface StoredRates { auto: Record<string, number>; manual: Record<string, number> }

const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

export function parseStoredRates(json: unknown): StoredRates {
  const pick = (o: unknown) => Object.fromEntries(Object.entries((o && typeof o === "object" ? o : {}) as Record<string, unknown>).filter(([k, v]) => CURRENCY_CODES.includes(k) && positive(v))) as Record<string, number>;
  const j = (json && typeof json === "object" ? json : {}) as { auto?: unknown; manual?: unknown };
  return { auto: pick(j.auto), manual: pick(j.manual) };
}

// The rate used for a currency, or null when the shop has none for it yet.
export function effectiveRate(rates: StoredRates, code: string): number | null {
  return rates.manual[code] ?? rates.auto[code] ?? null;
}

// Reads the answer of an exchange-rate service shaped like { rates: { USD: 0.012, ... } } for one rupee.
export function parseProviderRates(body: unknown): Record<string, number> | null {
  const rates = (body as { rates?: unknown } | null)?.rates;
  if (!rates || typeof rates !== "object") return null;
  const out: Record<string, number> = {};
  for (const code of CURRENCY_CODES) { const v = (rates as Record<string, unknown>)[code]; if (positive(v)) out[code] = v; }
  return Object.keys(out).length ? out : null;
}

// What an admin types ("1 USD = 83.5 rupees") and what is stored (units per rupee).
export const rateFromInrPerUnit = (inrPerUnit: number) => 1 / inrPerUnit;
export const inrPerUnit = (rate: number) => Math.round((1 / rate) * 10_000) / 10_000;

export type SelectionProblem = string | null;

export function selectionProblem(codes: string[], defaultCode: string): SelectionProblem {
  if (new Set(codes).size !== codes.length) return "A currency was chosen twice.";
  if (codes.length > MAX_CURRENCIES) return `Choose at most ${MAX_CURRENCIES} currencies.`;
  if (codes.some((c) => !CURRENCY_CODES.includes(c))) return "One of the currencies is not supported.";
  if (defaultCode !== BASE_CURRENCY && !codes.includes(defaultCode)) return "The default currency must be one of the offered currencies or the rupee.";
  return null;
}
