"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { inputClass, primaryButton } from "@/components/AuthShell";
import { API_URL } from "@/lib/api";
import { safeNext, useAuth, type AuthUser } from "@/lib/auth";
import { ErrorNote, Field } from "./fields";

const maskNumber = (n: string) => (n.length > 7 ? `${n.slice(0, 3)} ${"•".repeat(n.length - 7)}${n.slice(-4)}` : n);

// "9876543210", "+91 98765 43210" and "+1 415 555 0132" all work; the server stores one clean form.
const looksLikeNumber = (v: string) => /^\+?[\d\s().-]{8,20}$/.test(v.trim()) && v.replace(/\D/g, "").length >= 8;

export async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; data: T & { message?: string | string[] } }> {
  const res = await fetch(`${API_URL}${path}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as T & { message?: string | string[] } };
}
export const messageOf = (d: { message?: string | string[] }, fallback: string) => [d.message].flat().filter(Boolean).join(", ") || fallback;

// Mobile number sign-in: enter the number, then the 6-digit code sent by text message.
// `check` runs before a code is sent, so the sign-up form can insist on a name and the terms first.
export function PhoneFlow({ purpose, extra, check, afterLogin }: { purpose: "login" | "signup"; extra?: { name?: string; termsAccepted?: boolean }; check?: () => string | null; afterLogin?: (user: AuthUser) => string }) {
  const { login } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"number" | "code">("number");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  useEffect(() => { if (step === "code") codeInput.current?.focus(); }, [step]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    setError(""); setNote("");
    const problem = check?.() ?? null;
    if (problem) return setError(problem);
    if (!looksLikeNumber(phone)) return setError("Enter a valid mobile number, for example 98765 43210");
    setBusy(true);
    try {
      const { ok, data } = await post<{ resendInSeconds?: number }>("/auth/otp/send", { phone, purpose });
      if (!ok) throw new Error(messageOf(data, "We could not send the code. Please try again."));
      setStep("code"); setCode(""); setWait(data.resendInSeconds ?? 30);
      setNote(purpose === "login" ? "If this number has an account, a code is on its way." : "");
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  async function verify(value = code) {
    if (busy) return;
    setError("");
    if (!/^\d{6}$/.test(value)) return setError("Enter the 6-digit code");
    setBusy(true);
    try {
      const { ok, data } = await post<{ user: AuthUser }>("/auth/otp/verify", { phone, purpose, code: value, name: extra?.name, termsAccepted: extra?.termsAccepted });
      if (!ok) throw new Error(messageOf(data, "That code did not work. Please try again."));
      login(data.user);
      router.replace(safeNext(afterLogin ? afterLogin(data.user) : data.user.role === "CUSTOMER" ? "/" : "/admin"));
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  if (step === "code") {
    return (
      <form onSubmit={(e) => { e.preventDefault(); void verify(); }} className="space-y-4" aria-label="Enter your code">
        <div>
          <p className="text-sm text-ink-3">We sent a 6-digit code to <strong className="text-ink">{maskNumber(phone.replace(/\s/g, ""))}</strong>.</p>
          {note && <p className="mt-1 text-xs text-muted">{note}</p>}
        </div>
        <Field label="Verification code">
          <input
            ref={codeInput}
            value={code}
            onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); if (v.length === 6) void verify(v); }}
            inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" placeholder="••••••"
            className={`${inputClass} text-center font-mono text-2xl tracking-[0.5em]`}
          />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <button disabled={busy || code.length !== 6} className={primaryButton}>{busy ? "Checking…" : purpose === "signup" ? "Verify and create account" : "Verify and log in"}</button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={() => { setStep("number"); setError(""); setNote(""); }} className="font-semibold text-brand-700 hover:underline">Change number</button>
          {wait > 0
            ? <span className="text-muted" aria-live="polite">Resend in {wait}s</span>
            : <button type="button" onClick={() => void send()} disabled={busy} className="font-semibold text-brand-700 hover:underline disabled:opacity-60">Resend code</button>}
        </div>
        {process.env.NODE_ENV !== "production" && <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">Development: with no SMS provider the code is printed in the API terminal.</p>}
      </form>
    );
  }

  return (
    <form onSubmit={send} className="space-y-4" aria-label="Mobile number">
      <Field label="Mobile number" hint="We will text you a one-time code. Standard message rates may apply.">
        <div className="flex">
          <span className="grid place-items-center rounded-l-xl border border-r-0 border-line bg-canvas px-3.5 text-sm font-semibold text-ink-3" aria-hidden>+91</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" required className={`${inputClass} rounded-l-none`} />
        </div>
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <button disabled={busy} className={primaryButton}>{busy ? "Sending code…" : "Send code"}</button>
    </form>
  );
}
