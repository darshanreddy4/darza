"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthShell, inputClass, primaryButton } from "@/components/AuthShell";
import { API_URL } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setBusy(true);
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      if (res.status === 429) throw new Error("Too many requests. Please try again in a while.");
      if (res.status >= 500) throw new Error("Something went wrong. Please try again.");
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a link to choose a new one." footer={<Link href="/login" className="font-semibold text-brand-700 hover:underline">Back to log in</Link>}>
      {sent ? (
        <p role="status" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          If an account exists for that email, a reset link is on its way. It works for 1 hour. Check your spam folder if you don&apos;t see it.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">Email
            <input name="email" type="email" required autoComplete="email" className={`${inputClass} mt-1.5`} placeholder="you@example.com" />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button disabled={busy} className={primaryButton}>{busy ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
    </AuthShell>
  );
}
