"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { inputClass } from "@/components/AuthShell";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <span className="mt-1.5 block">{children}</span>
      {hint && <span className="mt-1.5 block text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-200"><svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg><span>{children}</span></p>;
}

export function PasswordField({ label = "Password", name = "password", value, onChange, autoComplete, placeholder, aside }: { label?: string; name?: string; value: string; onChange: (v: string) => void; autoComplete: "current-password" | "new-password"; placeholder?: string; aside?: ReactNode }) {
  const [shown, setShown] = useState(false);
  const id = useId();
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
        {aside}
      </div>
      <div className="relative mt-1.5">
        <input id={id} name={name} type={shown ? "text" : "password"} required value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} maxLength={128} placeholder={placeholder} className={`${inputClass} pr-16`} />
        <button type="button" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-label={shown ? "Hide password" : "Show password"} className="absolute inset-y-0 right-1.5 my-1.5 rounded-lg px-3 text-xs font-semibold text-muted hover:bg-canvas hover:text-ink">{shown ? "Hide" : "Show"}</button>
      </div>
    </div>
  );
}

const LEVELS = [
  { label: "Too short", bar: "bg-red-400", text: "text-red-600" },
  { label: "Weak", bar: "bg-red-400", text: "text-red-600" },
  { label: "Fair", bar: "bg-amber-400", text: "text-amber-700" },
  { label: "Good", bar: "bg-brand-500", text: "text-brand-700" },
  { label: "Strong", bar: "bg-brand-600", text: "text-brand-800" },
];

export function passwordChecks(pw: string) {
  return { length: pw.length >= 8, mix: /[A-Za-z]/.test(pw) && /\d/.test(pw), long: pw.length >= 12, symbol: /[^A-Za-z0-9]/.test(pw), cases: /[a-z]/.test(pw) && /[A-Z]/.test(pw) };
}

// Shows how a new password is shaping up; the server enforces the rules that matter.
export function PasswordMeter({ password }: { password: string }) {
  if (!password) return <p className="text-xs text-muted">Use 8 or more characters with letters and numbers.</p>;
  const c = passwordChecks(password);
  const score = !c.length ? 0 : 1 + Number(c.mix) + Number(c.long || c.cases) + Number(c.symbol || (c.long && c.cases));
  const level = LEVELS[Math.min(score, 4)];
  return (
    <div aria-live="polite" className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? level.bar : "bg-line"}`} />)}
        </div>
        <span className={`text-xs font-semibold ${level.text}`}>{level.label}</span>
      </div>
      <ul className="grid gap-1 text-xs sm:grid-cols-2">
        {[[c.length, "8 or more characters"], [c.mix, "Letters and numbers"]].map(([ok, text]) => (
          <li key={String(text)} className={`flex items-center gap-1.5 ${ok ? "text-brand-700" : "text-muted"}`}>
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{ok ? <path d="M5 12l5 5L20 7" /> : <circle cx="12" cy="12" r="8" />}</svg>
            {text as string}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TermsCheckbox({ checked, onChange, invalid }: { checked: boolean; onChange: (v: boolean) => void; invalid?: boolean }) {
  const id = useId();
  const link = "font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-700";
  return (
    <div className={`rounded-xl border px-3.5 py-3 transition ${invalid ? "border-red-300 bg-red-50/60" : "border-line bg-canvas/70"}`}>
      <div className="flex items-start gap-3">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={invalid} className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-emerald-600" />
        <label htmlFor={id} className="cursor-pointer text-sm leading-snug text-ink-3">
          I agree to the <Link href="/terms" target="_blank" rel="noopener noreferrer" className={link}>Terms &amp; Conditions</Link> and the <Link href="/privacy" target="_blank" rel="noopener noreferrer" className={link}>Privacy Policy</Link>.
        </label>
      </div>
    </div>
  );
}

export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-muted" role="separator">
      <span className="h-px flex-1 bg-line" />{children}<span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function MethodTabs<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="grid rounded-xl bg-canvas p-1 ring-1 ring-line" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.value)} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${on ? "bg-white text-ink shadow-card" : "text-muted hover:text-ink"}`}>
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={o.icon} /></svg>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const EMAIL_ICON = "M3 5h18v14H3zM3 7l9 6 9-6";
export const PHONE_ICON = "M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2";
