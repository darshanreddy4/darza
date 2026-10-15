"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL, formatPrice } from "@/lib/api";
import { useCouponCode } from "@/lib/quote";

interface Mine { code: string; description: string | null; type: "PERCENT" | "FLAT"; value: number; minOrderPaise: number; maxDiscountPaise: number | null; endsAt: string | null }

const offer = (c: Mine) => (c.type === "PERCENT" ? `${c.value}% off${c.maxDiscountPaise ? ` (up to ${formatPrice(c.maxDiscountPaise)})` : ""}` : `${formatPrice(c.value)} off`);

// Codes made just for this customer; hidden when there are none.
export function MyCoupons() {
  const [list, setList] = useState<Mine[] | null>(null);
  const [, setCode] = useCouponCode();

  useEffect(() => {
    let stale = false;
    fetch(`${API_URL}/coupons/mine`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (!stale) setList(d); })
      .catch(() => { if (!stale) setList([]); });
    return () => { stale = true; };
  }, []);

  if (!list || list.length === 0) return null;
  return (
    <section className="rounded-3xl border border-line bg-white p-7 shadow-card">
      <h2 className="text-lg font-bold">Your coupons</h2>
      <ul className="mt-4 space-y-3">
        {list.map((c) => (
          <li key={c.code} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 p-4 text-sm">
            <div>
              <p className="font-mono text-base font-bold">{c.code}</p>
              <p className="text-ink-3">{offer(c)}{c.minOrderPaise > 0 ? ` on orders of ${formatPrice(c.minOrderPaise)} or more` : ""}</p>
              {c.endsAt && <p className="text-xs text-muted">Valid until {new Date(c.endsAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>}
            </div>
            <Link href="/cart" onClick={() => setCode(c.code)} className="rounded-xl bg-ink px-4 py-2 font-semibold text-white hover:bg-ink-3">Use in cart</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
