"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AuthShell, primaryButton } from "@/components/AuthShell";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useBrand } from "@/components/BrandProvider";

type State = { status: "working" } | { status: "ok" } | { status: "failed"; message: string };

export function VerifyEmail({ token }: { token?: string }) {
  const { refresh } = useAuth();
  const brand = useBrand();
  const [state, setState] = useState<State>(token ? { status: "working" } : { status: "failed", message: "This link is incomplete. Open the link from your email." });
  // The link is single-use, so guard against React running the effect twice in development.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    fetch(`${API_URL}/auth/verify-email`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (res) => {
        if (res.ok) { setState({ status: "ok" }); refresh(); return; }
        const data = await res.json().catch(() => null);
        setState({ status: "failed", message: [data?.message].flat().filter(Boolean).join(", ") || "Something went wrong. Please try again." });
      })
      .catch(() => setState({ status: "failed", message: "Could not reach the server. Please try again." }));
  }, [token, refresh]);

  return (
    <AuthShell
      title={state.status === "ok" ? "Email verified" : state.status === "failed" ? "Couldn't verify your email" : "Verifying your email…"}
      subtitle={state.status === "ok" ? "Thanks, your email address is confirmed." : state.status === "failed" ? state.message : "One moment."}
      footer={<Link href="/" className="font-semibold text-brand-700 hover:underline">Continue to {brand}</Link>}
    >
      {state.status === "failed" && <Link href="/account" className={`${primaryButton} block text-center`}>Send a new verification email</Link>}
      {state.status === "ok" && <Link href="/" className={`${primaryButton} block text-center`}>Start shopping</Link>}
    </AuthShell>
  );
}
