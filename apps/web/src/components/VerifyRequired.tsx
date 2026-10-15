"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// Shown in place of an action (ordering, reviewing) that needs a confirmed email address.
export function VerifyRequired({ action, className = "" }: { action: string; className?: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  if (!user || user.verified || !user.email) return null;

  async function resend() {
    setState("sending");
    const res = await fetch(`${API_URL}/auth/resend-verification`, { method: "POST", credentials: "include" }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
  }

  return (
    <div role="status" className={`rounded-xl border border-gold/50 bg-gold-50 px-4 py-3 text-sm text-amber-900 ${className}`}>
      <p>Please verify your email address to {action}. We sent a link to <strong>{user.email}</strong>.</p>
      <p className="mt-1">
        {state === "sent" ? "A new link is on its way. Open it, then come back to this page." : (
          <button type="button" onClick={resend} disabled={state === "sending"} className="font-semibold underline disabled:opacity-60">{state === "sending" ? "Sending…" : "Resend the email"}</button>
        )}
        {state === "error" && <span className="ml-2 text-red-700">Could not send. Try again later.</span>}
      </p>
    </div>
  );
}
