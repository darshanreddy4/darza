"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { splitDuration, useNow } from "./Countdown";

const pad = (n: number) => String(n).padStart(2, "0");

// "Sale ends in 02 Hrs : 21 Min : 46 Sec". `msLeft` is worked out on the server, so the device clock is not trusted.
export function SaleTimer({ msLeft }: { msLeft: number }) {
  const router = useRouter();
  const now = useNow();
  const left = now ? Math.max(0, msLeft - (now.now - now.start)) : msLeft;
  const { days, hours, minutes, seconds, total } = splitDuration(left);
  const ended = now !== null && total <= 0;
  const urgent = total < 3600;

  // The price returns to normal on the server; keep asking until the page shows it.
  useEffect(() => {
    if (!ended) return;
    router.refresh();
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [ended, router]);

  const unit = (value: number, label: string) => (
    <span className="inline-flex items-baseline gap-1">
      <span className={`inline-grid min-w-9 place-items-center rounded-lg px-1.5 py-1 font-display text-lg font-bold tabular-nums text-white ${urgent ? "bg-red-600" : "bg-ink"}`}>{pad(value)}</span>
      <span className="text-xs font-semibold text-ink-3">{label}</span>
    </span>
  );
  const readable = `${days > 0 ? `${days} days ` : ""}${hours} hours ${minutes} minutes`;

  return (
    <div role="timer" aria-label={ended ? "Sale ended" : `Sale ends in ${readable}`}
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3 ${urgent ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
      <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>
        {ended ? "Sale ended" : urgent ? "Hurry, sale ends in" : "Sale ends in"}
      </span>
      {!ended && (
        <span className="inline-flex flex-wrap items-center gap-1.5" aria-hidden>
          {days > 0 && <>{unit(days, "Days")}<span className="font-bold">:</span></>}
          {unit(hours, "Hrs")}<span className="font-bold">:</span>{unit(minutes, "Min")}<span className="font-bold">:</span>{unit(seconds, "Sec")}
        </span>
      )}
    </div>
  );
}
