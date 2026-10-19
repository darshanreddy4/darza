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

// Colours and pictures for the header, search bar, category bar and footer. Only hex colours and our own uploads (or https pictures) are
// accepted, so nothing the admin types can reach the page as anything but a colour or an image address.
export interface ChromeSection { bg?: string; fg?: string; image?: string; overlay?: number; button?: string; buttonFg?: string }
export interface ChromeStyle { header?: ChromeSection; search?: ChromeSection; nav?: ChromeSection; footer?: ChromeSection }

const CHROME_FIELDS: Record<keyof ChromeStyle, { label: string; colors: (keyof ChromeSection)[]; image?: boolean }> = {
  header: { label: "Header", colors: ["bg", "fg"], image: true },
  search: { label: "Search bar", colors: ["bg", "fg", "button", "buttonFg"] },
  nav: { label: "Category bar", colors: ["bg", "fg"] },
  footer: { label: "Footer", colors: ["bg", "fg"], image: true },
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// "#1E3A8A" or "#fff" become "#1e3a8a" and "#ffffff"; anything else is not a colour.
export function hexColour(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const h = m[1].toLowerCase();
  return `#${h.length === 3 ? h.split("").map((c) => c + c).join("") : h}`;
}

const CHROME_IMAGE = /^(\/uploads\/[A-Za-z0-9._-]{1,200}|https:\/\/[^\s"'()<>\\]{1,1900})$/;

function cleanChrome(input: unknown, problems?: string[]): ChromeStyle {
  const out: ChromeStyle = {};
  if (!isObject(input)) return out;
  for (const [section, spec] of Object.entries(CHROME_FIELDS) as [keyof ChromeStyle, (typeof CHROME_FIELDS)[keyof ChromeStyle]][]) {
    const raw = input[section];
    if (raw === undefined || raw === null) continue;
    if (!isObject(raw)) { problems?.push(`${spec.label}: expected colours and a picture.`); continue; }
    const clean: ChromeSection = {};
    for (const key of spec.colors) {
      const v = raw[key];
      if (v === undefined || v === null || v === "") continue;
      const hex = hexColour(v);
      if (hex) (clean as Record<string, string>)[key] = hex; else problems?.push(`${spec.label}: "${String(v).slice(0, 30)}" is not a colour like #1e3a8a.`);
    }
    if (spec.image) {
      const image = raw.image;
      if (typeof image === "string" && image) {
        if (CHROME_IMAGE.test(image)) clean.image = image; else problems?.push(`${spec.label}: the picture must be one you uploaded or an https address.`);
      }
      const overlay = raw.overlay;
      if (overlay !== undefined && overlay !== null && overlay !== "") {
        if (typeof overlay === "number" && Number.isInteger(overlay) && overlay >= 0 && overlay <= 90) clean.overlay = overlay;
        else problems?.push(`${spec.label}: the picture tint must be a whole number from 0 to 90.`);
      }
    }
    if (Object.keys(clean).length) out[section] = clean;
  }
  return out;
}

// What an admin sends: bad values are reported, not silently dropped.
export function normaliseChrome(input: unknown): { value: ChromeStyle; problems: string[] } {
  const problems: string[] = [];
  const value = cleanChrome(input, problems);
  return { value, problems };
}

// What is read back from the database: anything unusable is ignored so a bad row can never break the storefront.
export const parseChrome = (json: unknown): ChromeStyle => cleanChrome(json);

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
