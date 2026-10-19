"use client";

import { useCurrency } from "@/lib/currency";
import { Dropdown } from "./Dropdown";

// Lets shoppers view prices in another currency; hidden unless the admin offers more than the rupee.
export function CurrencySwitcher() {
  const { config, code, setCode } = useCurrency();
  if (!config || config.options.length < 2) return null;
  return (
    <Dropdown
      label="Currency" value={code} onChange={setCode}
      groups={[{ options: config.options.map((o) => ({ value: o.code, label: o.code, detail: o.name })) }]}
      buttonClassName="h-10 min-w-[4.5rem] rounded-lg border border-white/20 bg-ink-3 px-3 text-sm font-semibold text-white outline-none hover:border-white/40 focus-visible:outline-2 focus-visible:outline-brand-500"
      panelClassName="left-auto right-0 min-w-52"
    />
  );
}
