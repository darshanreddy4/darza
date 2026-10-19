import { cache } from "react";
import { API_URL } from "@/lib/api";
import type { ChromeStyle } from "@/lib/chrome";

export const THEME_KEYS = ["DEFAULT", "MINIMAL", "MAXIMAL", "GLASS", "NEUMORPHIC", "FLAT", "MATERIAL", "EDITORIAL"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

export interface CurrencyOption { code: string; name: string; rate: number }
export interface CurrencyConfig { base: string; default: string; options: CurrencyOption[] }
export interface Appearance { theme: ThemeKey; currency: CurrencyConfig | null; chrome: ChromeStyle }

export const CURRENCY_COOKIE = "dmg-currency";
const FALLBACK: Appearance = { theme: "DEFAULT", currency: null, chrome: {} };

// One request per page view. If the API is down the store keeps its original look and rupee prices.
export const getAppearance = cache(async (): Promise<Appearance> => {
  const data: Appearance | null = await fetch(`${API_URL}/appearance`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return data && THEME_KEYS.includes(data.theme) ? { ...data, chrome: data.chrome ?? {} } : FALLBACK;
});

// The currency to start with: the visitor's earlier choice when it is still offered, otherwise the admin's default.
export function startingCurrency(config: CurrencyConfig | null, chosen?: string): string {
  if (!config) return "INR";
  return config.options.some((o) => o.code === chosen) ? chosen! : config.default;
}

// The value of the data-theme attribute; the original look has none.
export const themeAttr = (t: ThemeKey) => (t === "DEFAULT" ? undefined : t.toLowerCase());
