"use client";

import { useState, type FormEvent } from "react";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { messageOf, post } from "@/components/auth/PhoneFlow";
import { useAuthProviders } from "@/components/auth/useAuthProviders";
import { useAuth, type AuthUser } from "@/lib/auth";

const field = "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";
const button = "rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-3 disabled:opacity-60";
const looksLikeNumber = (v: string) => /^\+?[\d\s().-]{8,20}$/.test(v.trim()) && v.replace(/\D/g, "").length >= 8;

const Badge = ({ children }: { children: string }) => <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">{children}</span>;
const Note = ({ tone, children }: { tone: "ok" | "error"; children: string }) => <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ${tone === "ok" ? "bg-brand-50 text-brand-800" : "bg-red-50 text-red-700"}`}>{children}</p>;

function AddEmail() {
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setNote(null); setBusy(true);
    const { ok, data } = await post<object>("/auth/email", { email }).catch(() => ({ ok: false, data: {} as { message?: string } }));
    setBusy(false);
    setNote(ok ? { tone: "ok", text: `We sent a link to ${email}. Open it to finish adding this email address.` } : { tone: "error", text: messageOf(data, "Could not send the link. Please try again.") });
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3" aria-label="Add email form">
      <label className="block text-sm font-medium">Email address
        <input name="email" type="email" required maxLength={200} autoComplete="email" className={`${field} mt-1.5`} placeholder="you@example.com" />
      </label>
      {note && <Note tone={note.tone}>{note.text}</Note>}
      <button disabled={busy} className={button}>{busy ? "Sending…" : "Send confirmation link"}</button>
    </form>
  );
}

function AddPhone({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"number" | "code">("number");
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!looksLikeNumber(phone)) return setError("Enter a valid mobile number, for example 98765 43210");
    setBusy(true);
    const { ok, data } = await post<{ devCode?: string }>("/auth/phone/send", { phone }).catch(() => ({ ok: false, data: {} as { message?: string } }));
    setBusy(false);
    if (!ok) return setError(messageOf(data, "We could not send the code. Please try again."));
    setStep("code"); setCode(""); setDevCode((data as { devCode?: string }).devCode ?? "");
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code");
    setBusy(true);
    const { ok, data } = await post<object>("/auth/phone/verify", { phone, code }).catch(() => ({ ok: false, data: {} as { message?: string } }));
    setBusy(false);
    if (!ok) return setError(messageOf(data, "That code did not work. Please try again."));
    onDone();
  }

  return step === "number" ? (
    <form onSubmit={send} className="mt-3 space-y-3" aria-label="Add phone form">
      <label className="block text-sm font-medium">Mobile number
        <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel-national" required placeholder="98765 43210" className={`${field} mt-1.5`} />
        <span className="mt-1.5 block text-xs font-normal text-muted">We will text you a one-time code. Standard message rates may apply.</span>
      </label>
      {error && <Note tone="error">{error}</Note>}
      <button disabled={busy} className={button}>{busy ? "Sending…" : "Send code"}</button>
    </form>
  ) : (
    <form onSubmit={verify} className="mt-3 space-y-3" aria-label="Phone code form">
      <label className="block text-sm font-medium">6-digit code sent to {phone}
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} className={`${field} mt-1.5 font-mono tracking-widest`} />
      </label>
      {devCode && <p className="text-xs text-muted">Development: your code is <strong className="font-mono text-ink">{devCode}</strong></p>}
      {error && <Note tone="error">{error}</Note>}
      <div className="flex gap-3">
        <button disabled={busy || code.length !== 6} className={button}>{busy ? "Checking…" : "Add number"}</button>
        <button type="button" onClick={() => { setStep("number"); setError(""); }} className="text-sm font-semibold text-brand-700 hover:underline">Change number</button>
      </div>
    </form>
  );
}

// How this account can be reached and signed into. Phone-only accounts can add an email address, email accounts can add a
// number or Google, so no sign-in method leaves anyone out of order updates or account recovery.
export function SignInMethods() {
  const { user, refresh } = useAuth();
  const providers = useAuthProviders();
  const [google, setGoogle] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [open, setOpen] = useState<"email" | "phone" | null>(null);
  if (!user) return null;

  const canAddPhone = !user.phone && providers?.phone;
  const canLinkGoogle = !user.googleLinked && !!providers?.google;
  async function linkGoogle(credential: string) {
    setGoogle(null);
    const { ok, data } = await post<{ user?: AuthUser }>("/auth/google/link", { credential }).catch(() => ({ ok: false, data: {} as { message?: string } }));
    if (!ok) return setGoogle({ tone: "error", text: messageOf(data, "Could not link your Google account.") });
    await refresh();
    setGoogle({ tone: "ok", text: "Google account linked. You can now sign in with Google too." });
  }

  return (
    <section className="space-y-4 rounded-3xl border border-line bg-white p-7 shadow-card" aria-labelledby="methods-heading">
      <div>
        <h2 id="methods-heading" className="text-lg font-bold">Ways to sign in and get updates</h2>
        <p className="mt-1 text-sm text-muted">Add everything you use so order updates and account recovery always reach you.</p>
      </div>

      <div className="border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium">Email</span>
          {user.email ? <span className="flex items-center gap-2">{user.email}<Badge>{user.emailVerified ? "Verified" : "Not verified"}</Badge></span>
            : open === "email" ? <button onClick={() => setOpen(null)} className="inline-flex min-h-[32px] items-center font-semibold text-brand-700 hover:underline">Cancel</button>
            : <button onClick={() => setOpen("email")} className="inline-flex min-h-[32px] items-center font-semibold text-brand-700 hover:underline">Add email address</button>}
        </div>
        {!user.email && open === "email" && <AddEmail />}
        {!user.email && open !== "email" && <p className="mt-1 text-xs text-muted">Without an email address you will not get order emails or be able to set a password.</p>}
      </div>

      <div className="border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium">Mobile number</span>
          {user.phone ? <span className="flex items-center gap-2">{user.phone}<Badge>Verified</Badge></span>
            : canAddPhone ? (open === "phone" ? <button onClick={() => setOpen(null)} className="inline-flex min-h-[32px] items-center font-semibold text-brand-700 hover:underline">Cancel</button> : <button onClick={() => setOpen("phone")} className="inline-flex min-h-[32px] items-center font-semibold text-brand-700 hover:underline">Add mobile number</button>)
            : <span className="text-muted">Not added</span>}
        </div>
        {!user.phone && open === "phone" && canAddPhone && <AddPhone onDone={() => { setOpen(null); void refresh(); }} />}
      </div>

      <div className="border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium">Google</span>
          {user.googleLinked ? <Badge>Linked</Badge> : canLinkGoogle ? <span className="text-muted">Not linked</span> : <span className="text-muted">Not available</span>}
        </div>
        {canLinkGoogle && providers?.google && <div className="mt-3 max-w-sm"><GoogleButton clientId={providers.google.clientId} text="continue_with" onCredential={linkGoogle} /></div>}
        {google && <div className="mt-3"><Note tone={google.tone}>{google.text}</Note></div>}
      </div>
    </section>
  );
}
