"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export function EmailPreferences() {
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stale = false;
    fetch(`${API_URL}/me/email-preferences`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!stale && d) setOn(d.cartReminders); })
      .catch(() => {});
    return () => { stale = true; };
  }, []);

  async function change(next: boolean) {
    setError(false); setOn(next);
    const res = await fetch(`${API_URL}/me/email-preferences`, { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ cartReminders: next }) }).catch(() => null);
    if (!res?.ok) { setOn(!next); setError(true); }
  }

  return (
    <section className="rounded-3xl border border-line bg-white p-7 shadow-card">
      <h2 className="text-lg font-bold">Email preferences</h2>
      <label className="mt-3 flex items-start gap-3 text-sm">
        <input type="checkbox" checked={on ?? true} disabled={on === null} onChange={(e) => change(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
        <span><span className="font-medium">Remind me about items left in my cart</span><br /><span className="text-xs text-muted">One email, an hour or more after you leave. Order updates are always sent.</span></span>
      </label>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">Could not save that. Please try again.</p>}
    </section>
  );
}
