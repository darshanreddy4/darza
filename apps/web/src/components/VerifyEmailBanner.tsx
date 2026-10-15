"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function VerifyEmailBanner() {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  if (!user || user.verified || !user.email) return null;

  async function resend() {
    setState("sending");
    const res = await fetch(`${API_URL}/auth/resend-verification`, { method: "POST", credentials: "include" }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
  }

  return (
    <div role="status" className="border-b border-gold/40 bg-gold-50 px-4 py-2 text-center text-sm text-amber-900">
      {state === "sent" ? (
        <>We sent a verification link to <strong>{user.email}</strong>. Check your inbox.</>
      ) : (
        <>
          Please verify your email address (<strong>{user.email}</strong>).{" "}
          <button onClick={resend} disabled={state === "sending"} className="font-semibold underline disabled:opacity-60">{state === "sending" ? "Sending…" : "Resend the email"}</button>
          {state === "error" && <span className="ml-2 text-red-700">Could not send. Try again later.</span>}
        </>
      )}
    </div>
  );
}
