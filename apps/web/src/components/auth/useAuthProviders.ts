"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export interface AuthProviders { google: { clientId: string } | null; phone: boolean }

let cached: Promise<AuthProviders> | null = null;
const load = () => (cached ??= fetch(`${API_URL}/auth/providers`).then((r) => (r.ok ? r.json() : { google: null, phone: false })).catch(() => ({ google: null, phone: false })));

// Which sign-in options this site offers. Until the answer arrives nothing optional is shown, so the page never jumps.
export function useAuthProviders() {
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  useEffect(() => { let live = true; load().then((p) => { if (live) setProviders(p); }); return () => { live = false; }; }, []);
  return providers;
}
