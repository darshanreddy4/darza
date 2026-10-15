"use client";

import Link from "next/link";
import { useState } from "react";
import { API_URL } from "@/lib/api";

// Needs a click, so a mail scanner opening the link does not unsubscribe anyone.
export function UnsubscribeView({ token }: { token?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function confirm() {
    setState("busy");
    const res = await fetch(`${API_URL}/unsubscribe`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  }

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-3xl border border-line bg-white p-8 text-center shadow-card">
      <h1 className="text-2xl font-bold">Cart reminders</h1>
      {!token || state === "error" ? (
        <p role="alert" className="text-sm text-red-700">This link is not valid or has expired. You can also turn reminders off in <Link href="/account" className="font-semibold underline">My account</Link>.</p>
      ) : state === "done" ? (
        <p role="status" className="text-sm text-brand-800">Done. We won&apos;t send you cart reminders any more.</p>
      ) : (
        <>
          <p className="text-sm text-muted">Stop the emails that remind you about items left in your cart?</p>
          <button onClick={confirm} disabled={state === "busy"} className="rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-white hover:bg-ink-3 disabled:opacity-60">{state === "busy" ? "Working…" : "Stop cart reminders"}</button>
        </>
      )}
    </div>
  );
}
