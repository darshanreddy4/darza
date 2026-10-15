"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthShell, inputClass, primaryButton } from "@/components/AuthShell";
import { useBrand } from "@/components/BrandProvider";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { PhoneFlow } from "@/components/auth/PhoneFlow";
import { Divider, EMAIL_ICON, ErrorNote, Field, MethodTabs, PasswordField, PHONE_ICON } from "@/components/auth/fields";
import { useAuthProviders } from "@/components/auth/useAuthProviders";
import { API_URL } from "@/lib/api";
import { safeNext, useAuth, type AuthUser } from "@/lib/auth";

export default function LoginPage() {
  const brand = useBrand();
  const providers = useAuthProviders();
  const { login } = useAuth();
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [socialError, setSocialError] = useState("");

  const done = (user: AuthUser) => { login(user); router.replace(safeNext(user.role === "CUSTOMER" ? "/" : "/admin")); };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: String(f.get("email") ?? "").trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(res.status === 401 ? "Incorrect email or password" : res.status === 429 ? "Too many attempts. Please wait a minute and try again." : "Something went wrong. Please try again.");
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

  return (
    <AuthShell
      mode="login"
      title="Welcome back"
      subtitle={`Log in to your ${brand} account.`}
      footer={<>New to {brand}? <Link href="/signup" className="font-semibold text-brand-700 hover:underline">Create an account</Link></>}
    >
      {providers?.google && (
        <>
          <GoogleButton clientId={providers.google.clientId} text="signin_with" onCredential={google} />
          <ErrorNote>{socialError}</ErrorNote>
          <Divider>or log in with</Divider>
        </>
      )}

      {tabs.length > 1 && <MethodTabs label="Log in with" value={method} onChange={(m) => { setMethod(m); setError(""); }} options={tabs} />}

      {method === "email" || !providers?.phone ? (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <input name="email" type="email" required autoComplete="email" className={inputClass} placeholder="you@example.com" />
          </Field>
          <PasswordField value={password} onChange={setPassword} autoComplete="current-password" placeholder="••••••••" aside={<Link href="/forgot-password" className="text-xs font-semibold text-brand-700 hover:underline">Forgot password?</Link>} />
          <ErrorNote>{error}</ErrorNote>
          <button disabled={busy} className={primaryButton}>{busy ? "Signing in…" : "Log in"}</button>
        </form>
      ) : (
        <PhoneFlow purpose="login" />
      )}

      <p className="text-center text-xs leading-relaxed text-muted">
        By continuing you agree to our <Link href="/terms" target="_blank" className="font-medium underline underline-offset-2 hover:text-ink">Terms</Link> and <Link href="/privacy" target="_blank" className="font-medium underline underline-offset-2 hover:text-ink">Privacy Policy</Link>.
      </p>
    </AuthShell>
  );
}
