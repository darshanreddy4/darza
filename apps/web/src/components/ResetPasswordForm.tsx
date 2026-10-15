"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthShell, inputClass, primaryButton } from "@/components/AuthShell";
import { API_URL } from "@/lib/api";

export function ResetPasswordForm({ token }: { token?: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) return setError("Passwords do not match");
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password: f.get("password") }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error([data?.message].flat().filter(Boolean).join(", ") || "Something went wrong. Please try again.");
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  const footer = <Link href="/login" className="font-semibold text-brand-700 hover:underline">Back to log in</Link>;

  if (!token) {
    return (
      <AuthShell title="Reset link missing" subtitle="Open the link from your email, or request a new one." footer={footer}>
        <Link href="/forgot-password" className={`${primaryButton} block text-center`}>Request a new link</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="You'll be signed out everywhere else once it's changed." footer={footer}>
      {done ? (
        <div className="space-y-4">
          <p role="status" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">Your password has been changed. You can log in with it now.</p>
          <Link href="/login" className={`${primaryButton} block text-center`}>Log in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">New password
            <input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={`${inputClass} mt-1.5`} placeholder="At least 8 characters" />
          </label>
          <label className="block text-sm font-medium">Confirm new password
            <input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={`${inputClass} mt-1.5`} />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error} {error.includes("expired") && <Link href="/forgot-password" className="font-semibold underline">Request a new link</Link>}</p>}
          <button disabled={busy} className={primaryButton}>{busy ? "Saving…" : "Change password"}</button>
        </form>
      )}
    </AuthShell>
  );
}
