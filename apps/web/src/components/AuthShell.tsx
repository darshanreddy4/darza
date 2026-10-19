"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useBrandProfile } from "@/components/BrandProvider";

type Mode = "login" | "signup" | "recover";

const BENEFITS = [
  { icon: "M6 2l-3 4v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0", title: "Track every order", text: "Follow each order from placed to delivered, with email updates on the way." },
  { icon: "M13 2L4 14h7l-1 8 9-12h-7z", title: "Check out in seconds", text: "Save your addresses once. Pay online or on delivery." },
  { icon: "M9 12l2 2 4-4M12 3l8 3v6c0 4.500-3.400 8.300-8 9-4.600-.7-8-4.500-8-9V6z", title: "Know who you buy from", text: "Every product says whether we sell it or a partner does." },
  { icon: "M12 20s-8-5-8-11a4.500 4.500 0 0 1 8-2.800A4.500 4.500 0 0 1 20 9c0 6-8 11-8 11z", title: "Keep your favourites", text: "Build a wishlist and share verified reviews." },
];

const COPY: Record<Mode, { pill: string; headline: (name: string) => string; accent: string; text: (name: string) => string }> = {
  signup: {
    pill: "Free to join · takes under a minute",
    headline: (n) => `Welcome to ${n}.`,
    accent: "Shop smarter, from sellers you can trust.",
    text: (n) => `Create your account to order with confidence, follow every delivery and keep the things you love in one place. Everything on ${n} is clearly labelled, so you always know where you are buying.`,
  },
  login: {
    pill: "Good to see you again",
    headline: (n) => `Welcome back to ${n}.`,
    accent: "Your orders and favourites are waiting.",
    text: () => "Pick up right where you left off: track your deliveries, reorder in a few taps and check out faster with your saved details.",
  },
  recover: {
    pill: "Account help",
    headline: () => "We have got you covered.",
    accent: "Back in your account in a minute.",
    text: (n) => `Your ${n} account, orders and saved addresses are safe. Follow the steps and you will be signed in again shortly.`,
  },
};

// The page around every sign-in, sign-up and account recovery screen: a welcome panel beside a clean form card.
export function AuthShell({ title, subtitle, children, footer, mode = "recover" }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode; mode?: Mode }) {
  const brand = useBrandProfile();
  const name = brand.name;
  const copy = COPY[mode];

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside data-chrome="panel" className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="grid-pattern absolute inset-0" />
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute -bottom-24 left-10 h-80 w-80 rounded-full bg-gold/20 blur-3xl" />
        <Link href="/" className="relative w-fit"><Logo logoUrl={brand.logoUrl} name={name} onBadge={brand.logoOnBadge} design={brand.logoDesign} /></Link>

        <div className="relative max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium ring-1 ring-white/15">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> {copy.pill}
          </span>
          <h2 className="mt-6 text-4xl font-extrabold leading-[1.08] xl:text-5xl">
            {copy.headline(name)}
            <span className="mt-1 block bg-linear-to-r from-brand-500 to-gold bg-clip-text text-transparent">{copy.accent}</span>
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/70">{copy.text(name)}</p>

          {mode !== "recover" && (
            <ul className="mt-9 grid gap-5 sm:grid-cols-2">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-brand-500 ring-1 ring-white/10">
                    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={b.icon} /></svg>
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{b.title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/60">{b.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/60">
          <span className="flex items-center gap-2"><svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" /></svg> Encrypted and secure</span>
          <span className="flex items-center gap-2"><svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4M12 3l8 3v6c0 4.500-3.400 8.300-8 9-4.600-.7-8-4.500-8-9V6z" /></svg> We never sell your personal data</span>
          <span>© {new Date().getFullYear()} {name}</span>
        </div>
      </aside>

      <main className="flex flex-col bg-canvas">
        <div className="relative overflow-hidden bg-ink px-6 py-6 text-white lg:hidden">
          <div className="grid-pattern absolute inset-0" />
          <div className="relative">
            <Link href="/" className="block w-fit"><Logo logoUrl={brand.logoUrl} name={name} onBadge={brand.logoOnBadge} design={brand.logoDesign} /></Link>
            <p className="mt-3 text-sm font-medium text-white/80">{copy.headline(name)} <span className="text-brand-500">{copy.accent}</span></p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 sm:py-12">
          <div className="w-full max-w-md">
            <div className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-9">
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
              <div className="mt-7 space-y-5">{children}</div>
              <p className="mt-8 border-t border-line pt-6 text-center text-sm text-muted">{footer}</p>
            </div>
            <nav aria-label="Legal" className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted">
              <Link href="/terms" className="hover:text-ink hover:underline">Terms</Link>
              <Link href="/privacy" className="hover:text-ink hover:underline">Privacy</Link>
              <Link href="/contact" className="hover:text-ink hover:underline">Help &amp; contact</Link>
              <Link href="/" className="hover:text-ink hover:underline">Back to store</Link>
            </nav>
          </div>
        </div>
      </main>
    </div>
  );
}

export const inputClass = "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none transition placeholder:text-muted/60 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";
export const primaryButton = "w-full rounded-xl bg-ink px-6 py-3.5 font-semibold text-white shadow-sm transition hover:bg-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60";
