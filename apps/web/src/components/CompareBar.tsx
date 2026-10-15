"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAX_COMPARE, useCompare } from "@/lib/compare";
import { useCookieNoticeVisible } from "./CookieNotice";

// Appears once something has been picked for comparison.
export function CompareBar() {
  const { ids, clear } = useCompare();
  const pathname = usePathname();
  const noticeShowing = useCookieNoticeVisible();
  if (ids.length === 0 || pathname === "/compare") return null;
  return (
    <div role="region" aria-label="Product comparison" className={`fixed left-4 right-20 z-40 mx-auto ${noticeShowing ? "bottom-48 sm:bottom-32" : "bottom-4"} flex max-w-md items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lift sm:left-1/2 sm:right-auto sm:-translate-x-1/2`}>
      <span>{ids.length} of {MAX_COMPARE} selected</span>
      <span className="flex items-center gap-2">
        <button type="button" onClick={clear} className="rounded-lg px-3 py-2 text-white/70 hover:text-white">Clear</button>
        <Link href="/compare" className="rounded-lg bg-brand-500 px-4 py-2 font-semibold text-ink hover:bg-brand-600">Compare{ids.length < 2 ? " (add one more)" : ""}</Link>
      </span>
    </div>
  );
}
