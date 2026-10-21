"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { API_URL } from "@/lib/api";

// An account has an email, a phone number or both. "verified" means one of them is confirmed, which is what ordering and reviewing need.
export interface AuthUser { id: string; email: string | null; phone: string | null; name: string; role: "CUSTOMER" | "STAFF" | "ADMIN"; emailVerified: boolean; verified: boolean; hasPassword: boolean; googleLinked: boolean;
  // What the user may do in the admin area, and the name of their team role.
  permissions: string[]; staffRoleName: string | null; guestCheckout?: boolean }

// What to show as "who is signed in".
export const accountLabel = (u: Pick<AuthUser, "email" | "phone">) => u.email ?? u.phone ?? "";

interface AuthCtx {
  user: AuthUser | null;
  // False until the first /auth/me answer arrives; pages wait for it before redirecting to login.
  ready: boolean;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_URL}/auth/me`, { credentials: "include", cache: "no-store" });
    return res.ok ? ((await res.json()) as { user: AuthUser | null }).user : null;
  } catch {
    return null;
  }
}

// The session itself is an httpOnly cookie the browser sends on its own; JavaScript only ever sees the profile.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ user: AuthUser | null; ready: boolean }>({ user: null, ready: false });

  const refresh = useCallback(() => fetchMe().then((user) => setState({ user, ready: true })), []);

  useEffect(() => {
    // Earlier versions kept the session token here, readable by any script; drop leftovers.
    localStorage.removeItem("dmg-auth");
    refresh();
    // Picks up a login or logout done in another tab.
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const login = useCallback((user: AuthUser) => setState({ user, ready: true }), []);
  const logout = useCallback(async () => {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    setState({ user: null, ready: true });
  }, []);

  const value = useMemo<AuthCtx>(() => ({ ...state, login, logout, refresh }), [state, login, logout, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

// Returns the ?next= path only if it is a same-site relative path.
export function safeNext(fallback: string) {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
