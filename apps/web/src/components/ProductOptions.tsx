"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { discountPercent } from "@/components/ProductCard";
import { Money } from "@/lib/currency";
import { imgSized, type ProductOption } from "@/lib/api";

interface Ctx { names: string[]; options: ProductOption[]; picks: string[]; selected: ProductOption | null; pick: (kind: number, value: string) => void }
const OptionsCtx = createContext<Ctx | null>(null);

const matches = (o: ProductOption, picks: string[]) => o.values.every((v, i) => v === picks[i]);

// Shares what the shopper picked (a colour, a size, a wattage...) between the pickers, the price, the picture and the buy buttons.
export function OptionsProvider({ names, options, children }: { names: string[]; options: ProductOption[]; children: ReactNode }) {
  const kinds = names.length ? names : options[0]?.values.length === 1 ? ["Size"] : [];
  const first = options.find((o) => o.inStock) ?? options[0] ?? null;
  const [picks, setPicks] = useState<string[]>(first?.values ?? []);
  const selected = options.find((o) => matches(o, picks)) ?? first;

  // Choosing a value that doesn't come with the other choices made moves those to the closest option that does, preferring one in stock.
  const pick = (kind: number, value: string) => {
    const next = [...picks]; next[kind] = value;
    if (options.some((o) => matches(o, next))) return setPicks(next);
    const score = (o: ProductOption) => (o.inStock ? 100 : 0) + o.values.filter((v, i) => v === picks[i]).length;
    const best = options.filter((o) => o.values[kind] === value).sort((a, b) => score(b) - score(a))[0];
    if (best) setPicks(best.values);
  };
  return <OptionsCtx.Provider value={{ names: kinds, options, picks, selected, pick }}>{children}</OptionsCtx.Provider>;
}

// The chosen option, or null when the product has none.
export const useSelectedOption = () => useContext(OptionsCtx)?.selected ?? null;

// "Colour: Black, Size: L" for the cart.
export function useOptionText() {
  const ctx = useContext(OptionsCtx);
  if (!ctx?.selected) return "";
  return ctx.selected.values.map((v, i) => `${ctx.names[i] ?? "Option"}: ${v}`).join(", ");
}

export function OptionPicker() {
  const ctx = useContext(OptionsCtx);
  if (!ctx || ctx.options.length === 0) return null;
  const { options, names, picks, selected, pick } = ctx;
  return (
    <div className="space-y-4">
      {names.map((name, kind) => {
        const values = [...new Set(options.map((o) => o.values[kind]))];
        // A picture for every value (a colour) is shown as picture tiles, like a marketplace would.
        const pictures = new Map(values.map((v) => [v, options.find((o) => o.values[kind] === v && o.imageUrl)?.imageUrl ?? null]));
        const withPictures = values.every((v) => pictures.get(v));
        return (
          <div key={name}>
            <p className="text-sm font-semibold">{name}: <span className="font-normal text-ink-3">{selected?.values[kind]}</span></p>
            <ul className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
              {values.map((value) => {
                const on = value === picks[kind];
                // Sold out altogether: cannot be picked. Not available with the other choices made: shown crossed out but can still be picked.
                const anywhere = options.some((o) => o.values[kind] === value && o.inStock);
                const now = options.some((o) => o.inStock && o.values.every((v, i) => (i === kind ? v === value : v === picks[i])));
                const cls = on ? "border-ink" : anywhere ? "border-line hover:border-ink/40" : "cursor-not-allowed border-dashed border-line";
                return (
                  <li key={value}>
                    {withPictures ? (
                      <button type="button" role="radio" aria-checked={on} aria-label={value} title={value} disabled={!anywhere} onClick={() => pick(kind, value)}
                        className={`block h-16 w-16 overflow-hidden rounded-xl border-2 bg-canvas transition ${cls} ${now ? "" : "opacity-50"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imgSized(pictures.get(value)!, 160)} alt="" className="h-full w-full object-cover" />
                      </button>
                    ) : (
                      <button type="button" role="radio" aria-checked={on} disabled={!anywhere} onClick={() => pick(kind, value)}
                        className={`inline-flex min-w-16 items-center justify-center rounded-xl border-2 px-3.5 py-2 text-sm font-semibold transition ${on ? "bg-ink text-white" : now ? "" : "text-muted line-through"} ${cls}`}>
                        {value}{!now && <span className="sr-only"> (not available)</span>}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// The price block for a product with options: it follows the chosen one.
export function OptionPrice() {
  const option = useSelectedOption();
  if (!option) return null;
  const discount = discountPercent(option);
  return (
    <div className="flex flex-wrap items-baseline gap-3">
      <span className="font-display text-4xl font-bold" data-testid="option-price"><Money paise={option.pricePaise} /></span>
      {discount > 0 && (
        <>
          <span className="text-muted line-through"><Money paise={option.mrpPaise!} /></span>
          <span className="rounded-md bg-brand-50 px-2 py-0.5 text-sm font-semibold text-brand-800">Save {discount}%</span>
        </>
      )}
    </div>
  );
}
