"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const KEY = "dmg-notice-ack";
const CHANGE = "dmg-notice-change";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(CHANGE, cb);
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(CHANGE, cb); };
};

// True until the visitor has dismissed the notice; other floating bars use it to stay clear of it.
export function useCookieNoticeVisible() {
  return !useSyncExternalStore(subscribe, () => localStorage.getItem(KEY) === "1", () => true);
}

// Informational notice: the site only uses essential browser storage (login, cart, recently viewed).
export function CookieNotice({ ads = false }: { ads?: boolean }) {
  const acknowledged = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY) === "1", () => true);
  if (acknowledged) return null;

  return (
    <div role="region" aria-label="Cookie notice" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-line bg-white p-4 shadow-lift sm:flex sm:items-center sm:gap-4">
      <p className="text-sm text-ink-3">
        We use essential cookies and browser storage to keep you signed in and remember your cart. Embedded videos{ads ? " and the ads we show (Google AdSense)" : ""} may set their own cookies.{" "}
        <Link href="/privacy" className="font-semibold text-brand-700 underline">Read our privacy policy</Link>
      </p>
      <button
        onClick={() => { localStorage.setItem(KEY, "1"); window.dispatchEvent(new Event(CHANGE)); }}
        className="mt-3 w-full shrink-0 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-3 sm:mt-0 sm:w-auto"
      >
        Got it
      </button>
    </div>
  );
}
