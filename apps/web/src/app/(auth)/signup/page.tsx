"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthShell, inputClass, primaryButton } from "@/components/AuthShell";
import { useBrand } from "@/components/BrandProvider";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { PhoneFlow } from "@/components/auth/PhoneFlow";
import { Divider, EMAIL_ICON, ErrorNote, Field, MethodTabs, PasswordField, PasswordMeter, PHONE_ICON, TermsCheckbox } from "@/components/auth/fields";
import { useAuthProviders } from "@/components/auth/useAuthProviders";
import { API_URL } from "@/lib/api";
import { safeNext, useAuth, type AuthUser } from "@/lib/auth";

const TERMS_MESSAGE = "Please tick the box to accept the Terms & Conditions and Privacy Policy.";

export default function SignupPage() {
  const brand = useBrand();
  const providers = useAuthProviders();
  const { login } = useAuth();
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [socialError, setSocialError] = useState("");
  const [busy, setBusy] = useState(false);

  const done = (user: AuthUser) => { login(user); router.replace(safeNext("/")); };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!terms) return setError(TERMS_MESSAGE);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: String(f.get("email") ?? "").trim(), password, termsAccepted: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(res.status === 409 ? "An account with this email already exists. Try logging in." : [data?.message].flat().filter(Boolean).join(", ") || "Something went wrong. Please try again.");
      done((data as { user: AuthUser }).user);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function google(credential: string) {
    setSocialError("");
    const res = await fetch(`${API_URL}/auth/google`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ credential }) });
    const data = await res.json().catch(() => null);
    if (!res.ok) return setSocialError([data?.message].flat().filter(Boolean).join(", ") || "Google sign-in did not work. Please try again.");
    done((data as { user: AuthUser }).user);
  }

  const tabs = [{ value: "email" as const, label: "Email", icon: EMAIL_ICON }, ...(providers?.phone ? [{ value: "phone" as const, label: "Mobile number", icon: PHONE_ICON }] : [])];
  const nameField = (
    <Field label="Full name">
      <input name="name" required maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Your name" />
    </Field>
  );

  return (
    <AuthShell
      mode="signup"
      title="Create your account"
      subtitle={`Join ${brand} for free. Order with confidence, track every delivery and check out faster.`}
      footer={<>Already have an account? <Link href="/login" className="font-semibold text-brand-700 hover:underline">Log in</Link></>}
    >
      {providers?.google && (
        <>
          <GoogleButton clientId={providers.google.clientId} text="signup_with" onCredential={google} />
          <ErrorNote>{socialError}</ErrorNote>
          <p className="-mt-2 text-center text-xs text-muted">Continuing with Google means you agree to the Terms and Privacy Policy below.</p>
          <Divider>or sign up with</Divider>
        </>
      )}

      {tabs.length > 1 && <MethodTabs label="Sign up with" value={method} onChange={(m) => { setMethod(m); setError(""); }} options={tabs} />}

      {method === "email" || !providers?.phone ? (
        <form onSubmit={submit} className="space-y-4" noValidate={false}>
          {nameField}
          <Field label="Email">
            <input name="email" type="email" required autoComplete="email" className={inputClass} placeholder="you@example.com" />
          </Field>
          <div className="space-y-2.5">
            <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 8 characters" />
            <PasswordMeter password={password} />
          </div>
          <TermsCheckbox checked={terms} onChange={(v) => { setTerms(v); if (v && error === TERMS_MESSAGE) setError(""); }} invalid={error === TERMS_MESSAGE} />
          <ErrorNote>{error}</ErrorNote>
          <button disabled={busy} className={primaryButton}>{busy ? "Creating account…" : "Create account"}</button>
        </form>
      ) : (
        <div className="space-y-4">
          {nameField}
          <TermsCheckbox checked={terms} onChange={setTerms} />
          <PhoneFlow
            purpose="signup"
            extra={{ name: name.trim(), termsAccepted: terms }}
            check={() => (!name.trim() ? "Please enter your name." : !terms ? TERMS_MESSAGE : null)}
            afterLogin={() => "/"}
          />
        </div>
      )}
    </AuthShell>
  );
}
