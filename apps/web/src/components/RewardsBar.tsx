"use client";

import { useEffect, useId, useRef, useState } from "react";
import { celebrate } from "@/lib/confetti";
import { Money } from "@/lib/currency";
import type { Milestone, Quote } from "@/lib/quote";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Icon({ kind, size = 16 }: { kind: Milestone["kind"]; size?: number }) {
  if (kind === "gift") {
    return <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" {...stroke}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v8h14v-8M12 8c-1-3-5-4-5-1.500S10 8 12 8zm0 0c1-3 5-4 5-1.500S14 8 12 8z" /></svg>;
  }
  if (kind === "coupon") {
    return <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" {...stroke}><path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3z" /><path d="M14 6v12" strokeDasharray="2 2" /></svg>;
  }
  if (kind === "discount") {
    return <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" {...stroke}><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2.200" /><circle cx="17" cy="17" r="2.200" /></svg>;
  }
  return <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" {...stroke}><path d="M2 6h11v10H2zM13 9h4l3 3v4h-7" /><circle cx="6.500" cy="17.500" r="1.500" /><circle cx="16.500" cy="17.500" r="1.500" /></svg>;
}

const Check = ({ size = 14 }: { size?: number }) => <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={3}><path d="m5 12 5 5 9-10" /></svg>;

// The panel at the top of the cart and checkout: how much more to spend for free delivery, gifts and discounts, with every reward marked where
// it unlocks. A little party blast goes off when a reward is unlocked while the customer is shopping (not when a page opens with it already earned).
export function RewardsBar({ quote }: { quote: Quote | null }) {
  const [picked, setPicked] = useState<number | null>(null);
  const uid = useId();
  const milestones = quote?.rewards.milestones ?? [];
  const reachedKeys = milestones.filter((m) => m.reached).map((m) => `${m.kind}:${m.title}`).join("|");
  const seen = useRef<string[] | null>(null);

  useEffect(() => {
    if (!quote) return;
    const now = reachedKeys ? reachedKeys.split("|") : [];
    const before = seen.current;
    seen.current = now;
    if (before && now.some((k) => !before.includes(k))) celebrate();
  }, [quote, reachedKeys]);

  if (!quote || milestones.length === 0) return null;

  const { goodsPaise, next } = quote.rewards;
  const max = Math.max(...milestones.map((m) => m.atPaise), goodsPaise);
  const pct = (paise: number) => Math.min(100, Math.max(0, (paise / max) * 100));
  const shown = picked !== null ? milestones[picked] : null;
  const earned = milestones.filter((m) => m.reached);
  const nextIndex = milestones.findIndex((m) => !m.reached);

  return (
    <section aria-label="Rewards for your order" className="overflow-hidden rounded-3xl border border-line bg-white shadow-card">
      <div className="flex items-center gap-4 bg-gradient-to-r from-brand-50 via-white to-gold-50 px-5 py-4 sm:px-7">
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-500 text-ink shadow-lg shadow-brand-500/30"><Icon kind="gift" size={22} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug" aria-live="polite">
            {next
              ? <>Add <span className="text-brand-700"><Money paise={next.remainingPaise} /></span> more to get {next.title}</>
              : <>You have unlocked every reward{earned.length > 0 ? `: ${earned.map((m) => m.title).join(", ")}` : ""}</>}
          </p>
          <p className="mt-0.5 text-xs text-muted">Your cart is <Money paise={goodsPaise} /> &middot; {earned.length} of {milestones.length} rewards unlocked</p>
        </div>
      </div>

      <div className="px-5 pb-5 pt-7 sm:px-9">
        <div className="mx-4 sm:mx-5">
          <div role="progressbar" aria-label="Spend towards rewards" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(goodsPaise, max)} className="relative h-3 rounded-full bg-canvas ring-1 ring-line">
            <div className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-[width] duration-700 ease-out" style={{ width: `${pct(goodsPaise)}%` }}>
              <span aria-hidden className="reward-shimmer absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.5),transparent)]" />
            </div>
            {milestones.map((m, i) => (
              <button key={`${m.kind}-${m.atPaise}-${m.title}`} type="button" onClick={() => { setPicked(picked === i ? null : i); document.getElementById(`${uid}-${i}`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); }} onMouseEnter={() => setPicked(i)} onMouseLeave={() => setPicked(null)} onFocus={() => setPicked(i)} onBlur={() => setPicked(null)}
                aria-label={`${m.title}${m.reached ? " (unlocked)" : ""}`} style={{ left: `${pct(m.atPaise)}%` }}
                className={`absolute top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 transition ${m.reached ? "border-white bg-brand-500 text-ink shadow-md shadow-brand-500/40" : i === nextIndex ? "border-brand-500 bg-white text-brand-700 ring-4 ring-brand-500/20" : "border-line bg-white text-muted hover:border-brand-500"}`}>
                {m.reached ? <Check /> : <Icon kind={m.kind} />}
              </button>
            ))}
          </div>
        </div>

        <ul tabIndex={0} className="mt-6 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:thin]" aria-label="Rewards">
          {milestones.map((m, i) => (
            <li id={`${uid}-${i}`} key={`${m.kind}-${m.atPaise}-${m.title}`} className={`flex min-w-[15rem] flex-1 snap-start items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition ${picked === i ? "ring-2 ring-brand-500/40 " : ""}${m.reached ? "border-brand-200 bg-brand-50" : "border-line bg-canvas/60"}`}>
              <span aria-hidden className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${m.reached ? "bg-brand-500 text-ink" : "bg-white text-muted ring-1 ring-line"}`}><Icon kind={m.kind} size={15} /></span>
              <span className="min-w-0">
                <span className="line-clamp-2 font-medium leading-snug">{m.title}</span>
                <span className={`block text-xs ${m.reached ? "font-semibold text-brand-700" : "text-muted"}`}>
                  {m.reached ? "Unlocked" : <>At <Money paise={m.atPaise} /> &middot; <Money paise={m.atPaise - goodsPaise} /> to go</>}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-3 min-h-4 text-xs text-muted" aria-live="polite">
          {shown
            ? <>{shown.title}: {shown.reached ? "unlocked." : <>spend <Money paise={shown.atPaise} /> in total, <Money paise={shown.atPaise - goodsPaise} /> to go.</>}</>
            : "Tap a reward to see what it takes."}
        </p>
      </div>
    </section>
  );
}
