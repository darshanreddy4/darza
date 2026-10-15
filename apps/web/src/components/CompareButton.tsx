"use client";

import { useState } from "react";
import { MAX_COMPARE, useCompare } from "@/lib/compare";

export function CompareButton({ productId, className = "", label = false }: { productId: string; className?: string; label?: boolean }) {
  const { has, toggle } = useCompare();
  const [full, setFull] = useState(false);
  const active = has(productId);

  return (
    <>
      <button
        type="button"
        aria-pressed={active}
        aria-label={label ? undefined : active ? "Remove from comparison" : "Compare this product"}
        onClick={() => setFull(!toggle(productId))}
        className={`inline-flex items-center justify-center gap-2 rounded-full transition ${active ? "text-brand-700" : "text-ink-3 hover:text-brand-700"} ${className}`}
      >
        <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {active ? <path d="M5 12l5 5L20 7" /> : <path d="M7 4v16M17 4v16M3 8l4-4 4 4M13 16l4 4 4-4" />}
        </svg>
        {label && <span className="text-sm font-medium">{active ? "Added to comparison" : "Compare"}</span>}
      </button>
      {full && <span role="alert" className="sr-only">You can compare up to {MAX_COMPARE} products. Remove one first.</span>}
    </>
  );
}
