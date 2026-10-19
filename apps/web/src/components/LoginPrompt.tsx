"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function LoginPrompt({ open, onClose, next = "/checkout" }: { open: boolean; onClose: () => void; next?: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("a,button")?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>("a,button")];
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keys);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", keys); document.body.style.overflow = overflow; before?.focus(); };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  const to = encodeURIComponent(next);
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="login-prompt-title" className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-lift">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>
        </div>
        <h2 id="login-prompt-title" className="mt-4 text-xl font-bold">Please sign up or log in to proceed further</h2>
        <p className="mt-2 text-sm text-muted">It only takes a minute. Your cart stays just as it is.</p>
        <div className="mt-6 space-y-3">
          <Link href={`/login?next=${to}`} className="block rounded-xl bg-brand-500 px-6 py-3 font-semibold text-ink shadow-lg shadow-brand-500/25 hover:bg-brand-600">Log in</Link>
          <Link href={`/signup?next=${to}`} className="block rounded-xl border border-ink px-6 py-3 font-semibold hover:bg-ink hover:text-white">Create an account</Link>
          <button type="button" onClick={onClose} className="w-full px-4 py-2 text-sm font-medium text-muted hover:text-ink">Not now</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Sends signed-in customers to checkout, and shows the sign-in prompt to everyone else.
export function useCheckoutGate() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const go = useCallback(() => {
    if (ready) return user ? router.push("/checkout") : setOpen(true);
    // The page has only just opened and who is signed in is not known yet, so ask.
    fetch(`${API_URL}/auth/me`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((me: { user: unknown }) => (me.user ? router.push("/checkout") : setOpen(true)))
      .catch(() => setOpen(true));
  }, [ready, user, router]);

  // For a link to /checkout: signed-in customers follow it, everyone else gets the prompt.
  const guard = (e: MouseEvent) => {
    if (ready && user) return;
    e.preventDefault();
    go();
  };
  return { go, guard, prompt: <LoginPrompt open={open} onClose={close} /> };
}
