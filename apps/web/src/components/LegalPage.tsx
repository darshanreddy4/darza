import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_UPDATED, missingBusinessDetails } from "@/lib/business";

export const LEGAL_LINKS = [
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/shipping-policy", label: "Shipping Policy" },
  { href: "/refund-policy", label: "Cancellation & Refund Policy" },
  { href: "/affiliate-disclosure", label: "Affiliate Disclosure" },
  { href: "/contact", label: "Contact & Grievance" },
];

export function LegalPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  const missing = process.env.NODE_ENV !== "production" ? missingBusinessDetails() : [];
  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[220px_1fr]">
      <aside className="hidden lg:block">
        <nav aria-label="Policies" className="sticky top-44 space-y-1 text-sm">
          {LEGAL_LINKS.map((l) => <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-2 text-ink-3 hover:bg-white hover:text-ink">{l.label}</Link>)}
        </nav>
      </aside>
      <article className="rounded-3xl border border-line bg-white p-7 shadow-card sm:p-10">
        {missing.length > 0 && (
          <p className="mb-6 rounded-xl border border-gold/50 bg-gold-50 px-4 py-3 text-xs text-amber-900">
            Developer note (not shown in production): business details not set in <code>.env.local</code>: {missing.join(", ")}. Fill them in and have these policies reviewed by a legal professional before launch.
          </p>
        )}
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {LEGAL_UPDATED}</p>
        {intro && <p className="mt-6 leading-relaxed text-ink-3">{intro}</p>}
        <div className="mt-8 space-y-8">{children}</div>
      </article>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-ink-3">{children}</div>
    </section>
  );
}

export function List({ items }: { items: ReactNode[] }) {
  return <ul className="list-disc space-y-1.5 pl-5">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>;
}
