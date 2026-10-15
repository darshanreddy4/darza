"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { API_URL, type Product } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface WishlistCtx {
  ids: Set<string>;
  has: (id: string) => boolean;
  toggle: (id: string) => Promise<void>;
}

const Ctx = createContext<WishlistCtx | null>(null);
const NONE = new Set<string>();

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [loaded, setLoaded] = useState<{ userId: string; ids: Set<string> } | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let stale = false;
    fetch(`${API_URL}/wishlist`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((items: Product[]) => { if (!stale) setLoaded({ userId, ids: new Set(items.map((p) => p.id)) }); })
      .catch(() => {});
    return () => { stale = true; };
  }, [userId]);

  const ids = userId && loaded?.userId === userId ? loaded.ids : NONE;

  const toggle = useCallback(async (id: string) => {
    if (!userId) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
    const adding = !ids.has(id);
    const apply = (add: boolean) => setLoaded((cur) => {
      const next = new Set(cur?.ids ?? []);
      if (add) next.add(id); else next.delete(id);
      return { userId, ids: next };
    });
    apply(adding);
    const res = await fetch(`${API_URL}/wishlist/${id}`, { method: adding ? "POST" : "DELETE", credentials: "include" }).catch(() => null);
    if (!res?.ok) apply(!adding);
  }, [userId, ids, router, pathname]);

  const value = useMemo(() => ({ ids, has: (id: string) => ids.has(id), toggle }), [ids, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWishlist() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWishlist must be used inside WishlistProvider");
  return ctx;
}
