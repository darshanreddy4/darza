"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { formatPrice } from "@/lib/api";
import { CURRENCY_COOKIE, type CurrencyConfig } from "@/lib/appearance";

interface Ctx {
  config: CurrencyConfig | null;
  code: string;
  setCode: (code: string) => void;
  // A price in paise as text in the chosen currency.
  format: (paise: number) => string;
}

const CurrencyContext = createContext<Ctx>({ config: null, code: "INR", setCode: () => {}, format: formatPrice });

export const convertedText = (paise: number, code: string, rate: number) =>
  code === "INR" ? formatPrice(paise) : new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format((paise / 100) * rate);

// Shows prices in the currency the shopper picked. Everything is still stored and charged in rupees; this only changes how
// a price is written, using the rate the admin set or the live one.
export function CurrencyProvider({ config, initial, children }: { config: CurrencyConfig | null; initial: string; children: ReactNode }) {
  const [chosen, setChosen] = useState(initial);
  const active = config?.options.find((o) => o.code === chosen) ?? config?.options.find((o) => o.code === config.default) ?? null;
  const code = active?.code ?? "INR";

  const setCode = useCallback((next: string) => {
    setChosen(next);
    document.cookie = `${CURRENCY_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
  }, []);

  const value = useMemo<Ctx>(() => ({ config, code, setCode, format: (paise) => convertedText(paise, code, active?.rate ?? 1) }), [config, code, setCode, active]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export const useCurrency = () => useContext(CurrencyContext);

// A price. With `both`, the rupee amount that will be charged comes first and the converted amount follows in brackets.
export function Money({ paise, both = false, className }: { paise: number; both?: boolean; className?: string }) {
  const { code, format } = useCurrency();
  if (code === "INR") return <span className={className}>{formatPrice(paise)}</span>;
  return (
    <span className={className} title={`Shown in ${code} at today's rate. You are charged in INR.`}>
      {both ? <>{formatPrice(paise)} <span className="font-normal text-muted">(≈ {format(paise)})</span></> : format(paise)}
    </span>
  );
}

// Reminds shoppers that a converted price is a guide and what they actually pay.
export function CurrencyNote({ totalPaise }: { totalPaise: number }) {
  const { code, format } = useCurrency();
  if (code === "INR") return null;
  return (
    <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
      Prices in {code} are estimates from today&apos;s exchange rate (≈ {format(totalPaise)} in total). You are charged {formatPrice(totalPaise)} in Indian rupees.
    </p>
  );
}
