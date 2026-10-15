"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

export const MAX_COMPARE = 4;

interface CompareCtx {
  ids: string[];
  has: (id: string) => boolean;
  // Returns false when the list is full and the product was not added.
  toggle: (id: string) => boolean;
  remove: (id: string) => void;
  clear: () => void;
}

const Ctx = createContext<CompareCtx | null>(null);
const KEY = "dmg-compare";
const CHANGE = "dmg-compare-change";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(CHANGE, cb);
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(CHANGE, cb); };
};
const getSnapshot = () => localStorage.getItem(KEY) ?? "[]";
const getServerSnapshot = () => "[]";

const read = (): string[] => { try { const v = JSON.parse(getSnapshot()); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; } };
const write = (ids: string[]) => { localStorage.setItem(KEY, JSON.stringify(ids)); window.dispatchEvent(new Event(CHANGE)); };

export function CompareProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ids = useMemo<string[]>(() => { try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; } }, [raw]);

  const toggle = useCallback((id: string) => {
    const cur = read();
    if (cur.includes(id)) { write(cur.filter((x) => x !== id)); return true; }
    if (cur.length >= MAX_COMPARE) return false;
    write([...cur, id]);
    return true;
  }, []);
  const remove = useCallback((id: string) => write(read().filter((x) => x !== id)), []);
  const clear = useCallback(() => write([]), []);

  const value = useMemo(() => ({ ids, has: (id: string) => ids.includes(id), toggle, remove, clear }), [ids, toggle, remove, clear]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCompare() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCompare must be used inside CompareProvider");
  return ctx;
}
