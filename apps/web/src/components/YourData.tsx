"use client";

import { useState, type FormEvent } from "react";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { messageOf, post } from "@/components/auth/PhoneFlow";
import { useAuthProviders } from "@/components/auth/useAuthProviders";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const field = "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

type Method = "password" | "code" | "google";

// Download everything we hold about the account, or delete it.
export function YourData() {
  const { user } = useAuth();
  const providers = useAuthProviders();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<Method | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [credential, setCredential] = useState("");
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const methods: Method[] = [user.hasPassword ? "password" : null, user.phone && providers?.phone ? "code" : null, user.googleLinked && providers?.google ? "google" : null].filter((m): m is Method => !!m);
  const chosen = method && methods.includes(method) ? method : methods[0] ?? null;

  async function download() {
    setNote(null);
    const res = await fetch(`${API_URL}/me/export`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!res?.ok) return setNote({ tone: "error", text: "Could not prepare your data. Please try again." });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = "my-data.json";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setNote({ tone: "ok", text: "Your data was downloaded." });
  }

  async function sendCode() {
    setError(""); setBusy(true);
    const { ok, data } = await post<object>("/me/delete/code", {}).catch(() => ({ ok: false, data: {} as { message?: string } }));
    setBusy(false);
    if (!ok) return setError(messageOf(data, "We could not send the code."));
    setCodeSent(true);
  }

  async function remove(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const proof = chosen === "password" ? { password: String(f.get("password") ?? "") } : chosen === "code" ? { code: String(f.get("code") ?? "") } : { googleCredential: credential };
    setBusy(true);
    const { ok, data } = await post<object>("/me/delete", { confirm: String(f.get("confirm") ?? ""), ...proof }).catch(() => ({ ok: false, data: {} as { message?: string } }));
    if (!ok) { setBusy(false); return setError(messageOf(data, "Could not delete your account.")); }
    // The server has already ended the session. A full page load drops the signed-in state without the account page sending them to the login screen first.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/?deleted=1";
  }

  return (
    <section className="space-y-4 rounded-3xl border border-line bg-white p-7 shadow-card" aria-labelledby="data-heading">
      <h2 id="data-heading" className="text-lg font-bold">Your data</h2>

      <div>
        <p className="text-sm text-muted">Download a copy of your details, addresses, orders, returns, reviews and questions as a file.</p>
        <button onClick={download} className="mt-3 rounded-xl border border-line px-5 py-2.5 text-sm font-semibold transition hover:bg-canvas">Download my data</button>
        {note && <p role={note.tone === "error" ? "alert" : "status"} className={`mt-3 rounded-lg px-3 py-2 text-sm ${note.tone === "ok" ? "bg-brand-50 text-brand-800" : "bg-red-50 text-red-700"}`}>{note.text}</p>}
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="font-semibold text-red-700">Delete my account</h3>
        <p className="mt-1 text-sm text-muted">This removes your profile, addresses, wishlist, reviews and questions, and signs you out everywhere. It cannot be undone. Past orders and invoices are kept, because tax records must be, but they are no longer linked to a profile you can sign in to.</p>
        {!open ? (
          <button onClick={() => setOpen(true)} className="mt-3 rounded-xl border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50">Delete my account</button>
        ) : (
          <form onSubmit={remove} className="mt-4 space-y-4" aria-label="Delete account">
            {methods.length > 1 && (
              <fieldset className="flex flex-wrap gap-4 text-sm">
                <legend className="mb-1 font-medium">Confirm it is you with</legend>
                {methods.map((m) => (
                  <label key={m} className="flex items-center gap-2"><input type="radio" name="method" checked={chosen === m} onChange={() => setMethod(m)} className="accent-emerald-600" />{m === "password" ? "My password" : m === "code" ? "A code by text message" : "Google"}</label>
                ))}
              </fieldset>
            )}
            {!chosen && <p className="rounded-lg bg-gold-50 px-3 py-2 text-sm text-amber-900">Set a password or add a mobile number above first, so we can confirm it is you.</p>}
            {chosen === "password" && (
              <label className="block text-sm font-medium">Your password
                <input name="password" type="password" required maxLength={128} autoComplete="current-password" className={`${field} mt-1.5`} />
              </label>
            )}
            {chosen === "code" && (
              <div className="space-y-3 text-sm">
                <button type="button" onClick={sendCode} disabled={busy} className="rounded-xl border border-line px-4 py-2 font-semibold hover:bg-canvas disabled:opacity-60">{codeSent ? "Send a new code" : `Text a code to ${user.phone}`}</button>
                {codeSent && (
                  <label className="block font-medium">6-digit code
                    <input name="code" required inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" className={`${field} mt-1.5 font-mono tracking-widest`} />
                  </label>
                )}
              </div>
            )}
            {chosen === "google" && providers?.google && (
              <div className="max-w-sm">
                {credential ? <p role="status" className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">Google confirmed.</p> : <GoogleButton clientId={providers.google.clientId} text="continue_with" onCredential={setCredential} />}
              </div>
            )}
            <label className="block text-sm font-medium">Type DELETE to confirm
              <input name="confirm" required autoComplete="off" className={`${field} mt-1.5`} placeholder="DELETE" />
            </label>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex gap-3">
              <button disabled={busy || !chosen || (chosen === "code" && !codeSent) || (chosen === "google" && !credential)} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">{busy ? "Deleting…" : "Permanently delete my account"}</button>
              <button type="button" onClick={() => { setOpen(false); setError(""); }} className="text-sm font-semibold text-muted hover:underline">Keep my account</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
