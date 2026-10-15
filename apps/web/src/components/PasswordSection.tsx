"use client";

import { useState, type FormEvent } from "react";
import { API_URL } from "@/lib/api";
import { useAuth, type AuthUser } from "@/lib/auth";

const field = "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

// Change the password, or set the first one for an account made with a phone number or Google.
export function PasswordSection() {
  const { user, login } = useAuth();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const hasPassword = user.hasPassword;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const form = e.currentTarget;
    const f = new FormData(form);
    if (f.get("newPassword") !== f.get("confirm")) return setMsg({ tone: "error", text: "New passwords do not match" });
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/auth/${hasPassword ? "change-password" : "set-password"}`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify(hasPassword ? { currentPassword: f.get("currentPassword"), newPassword: f.get("newPassword") } : { newPassword: f.get("newPassword") }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error([data?.message].flat().filter(Boolean).join(", ") || "Could not save your password");
      login((data as { user: AuthUser }).user);
      form.reset();
      setMsg({ tone: "ok", text: hasPassword ? "Password changed. Other devices have been signed out." : "Password set. You can now sign in with your email and password." });
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    }
    setBusy(false);
  }

  if (!user.email) {
    return (
      <section className="rounded-3xl border border-line bg-white p-7 shadow-card">
        <h2 className="text-lg font-bold">Password</h2>
        <p className="mt-1 text-sm text-muted">You sign in with a code sent to your phone. Add an email address above if you also want to sign in with a password.</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-line bg-white p-7 shadow-card">
      <h2 className="text-lg font-bold">{hasPassword ? "Change password" : "Set a password"}</h2>
      {!hasPassword && <p className="mt-1 text-sm text-muted">You signed up with {user.googleLinked ? "Google" : "a phone number"}, so there is no password yet. Set one to also sign in with {user.email}.</p>}
      <form onSubmit={submit} className="mt-4 space-y-4">
        {hasPassword && (
          <label className="block text-sm font-medium">Current password
            <input name="currentPassword" type="password" required maxLength={128} autoComplete="current-password" className={`${field} mt-1.5`} />
          </label>
        )}
        <label className="block text-sm font-medium">{hasPassword ? "New password" : "Password"}
          <input name="newPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={`${field} mt-1.5`} placeholder="At least 8 characters" />
        </label>
        <label className="block text-sm font-medium">Confirm {hasPassword ? "new " : ""}password
          <input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={`${field} mt-1.5`} />
        </label>
        {msg && <p role={msg.tone === "error" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ${msg.tone === "ok" ? "bg-brand-50 text-brand-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
        <button disabled={busy} className="rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-ink-3 disabled:opacity-60">{busy ? "Saving…" : hasPassword ? "Change password" : "Set password"}</button>
      </form>
    </section>
  );
}
