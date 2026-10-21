"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

export interface CartLine {
  productId: string; slug: string; name: string; image: string | null; pricePaise: number; quantity: number;
  // The option chosen, for a product that comes in several: its label ("Black / L") and a readable line ("Colour: Black, Size: L").
  optionId?: string; optionLabel?: string; optionText?: string;
}

// The same product in two sizes is two lines.
export const cartKey = (l: { productId: string; optionId?: string | null }) => (l.optionId ? `${l.productId}:${l.optionId}` : l.productId);

interface CartCtx {
  lines: CartLine[];
  add: (line: Omit<CartLine, "quantity">) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  count: number;
  totalPaise: number;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = "dmg-cart";
const CHANGE = "dmg-cart-change";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(CHANGE, cb);
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(CHANGE, cb); };
};
const getSnapshot = () => localStorage.getItem(KEY) ?? "[]";
const getServerSnapshot = () => "[]";

function read(): CartLine[] {
  try { return JSON.parse(getSnapshot()); } catch { return []; }
}
function write(lines: CartLine[]) {
  localStorage.setItem(KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event(CHANGE));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const lines = useMemo<CartLine[]>(() => {
    try { return JSON.parse(raw); } catch { return []; }
  }, [raw]);

  const add = useCallback((l: Omit<CartLine, "quantity">) => {
    const cur = read();
    write(cur.some((c) => cartKey(c) === cartKey(l))
      ? cur.map((c) => (cartKey(c) === cartKey(l) ? { ...c, quantity: Math.min(c.quantity + 1, 99) } : c))
      : [...cur, { ...l, quantity: 1 }]);
  }, []);
  const setQuantity = useCallback((key: string, q: number) => {
    const cur = read();
    write(q <= 0 ? cur.filter((c) => cartKey(c) !== key) : cur.map((c) => (cartKey(c) === key ? { ...c, quantity: Math.min(q, 99) } : c)));
  }, []);
  const remove = useCallback((key: string) => write(read().filter((c) => cartKey(c) !== key)), []);
  const clear = useCallback(() => write([]), []);

  const value: CartCtx = {
    lines, add, setQuantity, remove, clear,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    totalPaise: lines.reduce((n, l) => n + l.quantity * l.pricePaise, 0),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
