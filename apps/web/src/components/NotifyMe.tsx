"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// Shown in place of the buy button's promise when a product is sold out.
export function NotifyMe({ slug }: { slug: string }) {
  const { user, ready } = useAuth();
  const [state, setState] = useState<{ subscribed: boolean; emailReady: boolean } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const userId = user?.id;
  const url = `${API_URL}/products/${encodeURIComponent(slug)}/stock-alert`;

  useEffect(() => {
    if (!userId) return;
    let stale = false;
    fetch(url, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!stale && d) setState(d); })
      .catch(() => {});
    return () => { stale = true; };
  }, [userId, url]);

  async function toggle(on: boolean) {
    setError(""); setBusy(true);
    const res = await fetch(url, { method: on ? "POST" : "DELETE", credentials: "include" }).catch(() => null);
    if (res?.ok) setState((s) => (s ? { ...s, subscribed: on } : s));
    else setError(res ? [(await res.json().catch(() => null))?.message].flat().filter(Boolean).join(", ") || "Could not save that." : "Could not save that.");
    setBusy(false);
  }

  if (!ready) return null;
  if (!user) {
    return <p className="rounded-xl bg-canvas p-3 text-sm"><Link href={`/login?next=${encodeURIComponent(`/products/${slug}`)}`} className="font-semibold text-brand-700 underline">Log in</Link> to get an email when this is back in stock.</p>;
  }
  if (!state) return null;
  if (!state.emailReady) {
    return <p className="rounded-xl bg-canvas p-3 text-sm text-muted">Back-in-stock alerts are sent by email. Add and verify an email address in <Link href="/account" className="font-semibold text-brand-700 underline">My account</Link> to use them.</p>;
  }
  return (
    <div className="space-y-2 rounded-xl bg-canvas p-3 text-sm">
      {state.subscribed ? (
        <p role="status">We&apos;ll email you once this is back in stock. <button onClick={() => toggle(false)} disabled={busy} className="font-semibold text-brand-700 underline disabled:opacity-60">Cancel alert</button></p>
      ) : (
        <button onClick={() => toggle(true)} disabled={busy} className="w-full rounded-xl border border-ink px-4 py-2.5 font-semibold hover:bg-ink hover:text-white disabled:opacity-60">Notify me when it&apos;s back</button>
      )}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </div>
  );
}
