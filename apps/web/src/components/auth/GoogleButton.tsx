"use client";

import { useEffect, useRef, useState } from "react";

interface GoogleId {
  initialize(config: { client_id: string; callback: (r: { credential?: string }) => void; ux_mode?: "popup"; auto_select?: boolean; cancel_on_tap_outside?: boolean }): void;
  renderButton(el: HTMLElement, options: Record<string, unknown>): void;
}
declare global { interface Window { google?: { accounts: { id: GoogleId } } } }

let script: Promise<void> | null = null;
const loadGoogle = () =>
  (script ??= new Promise<void>((resolve, reject) => {
    if (window.google?.accounts) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { script = null; reject(new Error("blocked")); };
    document.head.appendChild(s);
  }));

// Google's own button, so it looks and behaves the way people expect. Google returns a signed ID token that our API verifies.
export function GoogleButton({ clientId, text, onCredential }: { clientId: string; text: "signin_with" | "signup_with" | "continue_with"; onCredential: (credential: string) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const [state, setState] = useState<"loading" | "ready" | "blocked">("loading");

  useEffect(() => { callback.current = onCredential; }, [onCredential]);

  useEffect(() => {
    let live = true;
    loadGoogle()
      .then(() => {
        const el = holder.current;
        if (!live || !el || !window.google) return;
        window.google.accounts.id.initialize({ client_id: clientId, ux_mode: "popup", auto_select: false, callback: (r) => { if (r.credential) callback.current(r.credential); } });
        window.google.accounts.id.renderButton(el, { type: "standard", theme: "outline", size: "large", text, shape: "rectangular", logo_alignment: "center", width: Math.min(400, Math.max(240, el.parentElement?.clientWidth ?? 320)) });
        setState("ready");
      })
      .catch(() => { if (live) setState("blocked"); });
    return () => { live = false; };
  }, [clientId, text]);

  return (
    <div>
      <div ref={holder} className={`flex min-h-[44px] justify-center ${state === "ready" ? "" : "hidden"}`} data-testid="google-button" />
      {state === "loading" && <div className="h-11 animate-pulse rounded-xl bg-canvas ring-1 ring-line" aria-hidden />}
      {state === "blocked" && <p className="rounded-xl bg-canvas px-4 py-3 text-center text-sm text-muted ring-1 ring-line">Google sign-in could not load. Check your connection or use another option below.</p>}
    </div>
  );
}
