"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { EmailPreferences } from "@/components/EmailPreferences";
import { PasswordSection } from "@/components/PasswordSection";
import { SignInMethods } from "@/components/SignInMethods";
import { YourData } from "@/components/YourData";
import { MyCoupons } from "@/components/MyCoupons";
import { SavedAddresses } from "@/components/SavedAddresses";

export function AccountView() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [mail, setMail] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/account");
  }, [ready, user, router]);

  if (!ready || !user) return <p className="text-sm text-muted">Loading…</p>;

  async function resend() {
    setMail("sending");
    const res = await fetch(`${API_URL}/auth/resend-verification`, { method: "POST", credentials: "include" }).catch(() => null);
    setMail(res?.ok ? "sent" : "error");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">My account</h1>

      <section className="space-y-3 rounded-3xl border border-line bg-white p-7 shadow-card">
        <h2 className="text-lg font-bold">Profile</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Name</dt><dd className="font-medium">{user.name}</dd></div>
          {user.email && (
            <div>
              <dt className="text-muted">Email</dt>
              <dd className="flex flex-wrap items-center gap-2 font-medium">
                {user.email}
                {user.emailVerified
                  ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">Verified</span>
                  : <span className="rounded-full bg-gold-50 px-2 py-0.5 text-xs font-semibold text-amber-900">Not verified</span>}
              </dd>
            </div>
          )}
          {user.phone && (
            <div>
              <dt className="text-muted">Mobile number</dt>
              <dd className="flex flex-wrap items-center gap-2 font-medium">
                {user.phone}
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">Verified</span>
              </dd>
            </div>
          )}
        </dl>
        {user.email && !user.emailVerified && (
          <p className="text-sm">
            {mail === "sent" ? "Verification email sent. Check your inbox." : (
              <button onClick={resend} disabled={mail === "sending"} className="font-semibold text-brand-700 underline disabled:opacity-60">{mail === "sending" ? "Sending…" : "Send me a verification email"}</button>
            )}
            {mail === "error" && <span className="ml-2 text-red-700">Could not send. Try again later.</span>}
          </p>
        )}
      </section>

      <MyCoupons />

      <SavedAddresses />

      {user.email && <EmailPreferences />}

      <SignInMethods />

      <PasswordSection />

      <YourData />
    </div>
  );
}
