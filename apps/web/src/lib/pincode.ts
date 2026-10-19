"use client";

import { useSyncExternalStore } from "react";
import { API_URL } from "@/lib/api";
import type { StoreDelivery } from "@/lib/labels";

export interface PincodeInfo {
  pincode: string;
  valid: boolean;
  reason?: "format" | "unknown";
  city?: string;
  district?: string;
  state?: string;
  // Every state the PIN code could belong to; empty when that is not known.
  states: string[];
  areas?: string[];
  source?: "post-office" | "region";
}

export const isPincode = (v: string) => /^[1-9]\d{5}$/.test(v);

// What delivery to one PIN code costs: the store's fee, or the fee of the area it falls in. Null when the shop could not be reached.
export async function lookupDelivery(pin: string): Promise<StoreDelivery | null> {
  try {
    const res = await fetch(`${API_URL}/store/delivery?pincode=${pin}`, { cache: "no-store" });
    if (!res.ok) return null;
    const d = (await res.json()) as { feePaise: number; freeOverPaise: number | null; freeAllOverPaise: number | null };
    return { shippingFeePaise: d.feePaise, freeShippingOverPaise: d.freeOverPaise, freeAllOverPaise: d.freeAllOverPaise };
  } catch {
    return null;
  }
}

// Asks the shop whether a PIN code exists and where it is. Null when the shop could not be reached.
export async function lookupPincode(pin: string): Promise<PincodeInfo | null> {
  try {
    const res = await fetch(`${API_URL}/pincode/${pin}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as PincodeInfo) : null;
  } catch {
    return null;
  }
}

// Does the chosen state fit the PIN code? True whenever that is not known.
export const stateFits = (state: string, info: Pick<PincodeInfo, "states">) => !state || info.states.length === 0 || info.states.includes(state);

export const placeName = (info: PincodeInfo) => [info.city, info.state ?? (info.states.length === 1 ? info.states[0] : "")].filter(Boolean).join(", ");

const KEY = "dmg-pincode";
const CHANGE = "dmg-pincode-change";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(CHANGE, cb);
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(CHANGE, cb); };
};

// The PIN code the visitor last checked, kept on their device so they do not have to type it on every product.
export function useSavedPincode(): [string, (pin: string) => void] {
  const pin = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY) ?? "", () => "");
  const set = (next: string) => {
    if (next) localStorage.setItem(KEY, next); else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(CHANGE));
  };
  return [pin, set];
}
