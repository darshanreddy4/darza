"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

export function splitDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60, total };
}

// Ticks every second. Returns null until mounted so server and client markup match;
// `start` is the first tick, so callers can count down from a server-computed duration without trusting the device clock.
export function useNow(intervalMs = 1000, enabled = true) {
  const [state, setState] = useState<{ now: number; start: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setState((cur) => { const now = Date.now(); return { now, start: cur?.start ?? now }; });
    const raf = requestAnimationFrame(tick);
    const id = setInterval(tick, intervalMs);
    return () => { cancelAnimationFrame(raf); clearInterval(id); };
  }, [intervalMs, enabled]);
  return state;
}

export function Countdown({ msLeft, tone }: { msLeft: number; tone: "LIGHT" | "DARK" }) {
  const { days, hours, minutes, seconds, total } = splitDuration(msLeft);
  const urgent = total < 3600;
  const cell = `grid min-w-9 place-items-center rounded-lg px-1.5 py-1 font-display text-base font-bold tabular-nums sm:min-w-11 sm:text-xl ${
    urgent ? "bg-red-600 text-white" : tone === "LIGHT" ? "bg-white text-ink" : "bg-ink text-white"
  }`;
  const unit = (value: number, label: string) => (
    <span className="flex flex-col items-center gap-0.5">
      <span className={cell}>{pad(value)}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">{label}</span>
    </span>
  );
  const readable = `${days > 0 ? `${days} days ` : ""}${hours} hours ${minutes} minutes ${seconds} seconds`;

  return (
    <div className="flex flex-col gap-1.5" role="timer" aria-label={`Deal ends in ${readable}`}>
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>
        {urgent ? "Ending soon" : "Deal ends in"}
      </span>
      <div className="flex items-start gap-1.5 sm:gap-2" aria-hidden>
        {days > 0 && unit(days, "days")}
        {unit(hours, "hrs")}
        {unit(minutes, "min")}
        {unit(seconds, "sec")}
      </div>
    </div>
  );
}
