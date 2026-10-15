"use client";

import Link from "next/link";
import { useRef, useState, type UIEvent } from "react";
import type { Product } from "@/lib/api";
import { ProductCard } from "./ProductCard";

export function ProductCarousel({ title, subtitle, href, items }: { title: string; subtitle?: string; href?: string; items: Product[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  if (items.length === 0) return null;

  const update = (el: HTMLElement) => {
    const next = { start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 };
    setEdges((cur) => (cur.start === next.start && cur.end === next.end ? cur : next));
  };
  const scrollBy = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.85, behavior: "smooth" });
  const arrow = "absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-white text-ink shadow-lift transition hover:bg-canvas disabled:pointer-events-none disabled:opacity-0 md:grid";

  return (
    <section aria-label={title}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {href && <Link href={href} className="shrink-0 text-sm font-semibold text-brand-700 hover:underline">See all →</Link>}
      </div>

      <div className="relative">
        <button type="button" onClick={() => scrollBy(-1)} disabled={edges.start} aria-label={`Scroll ${title} left`} className={`${arrow} -left-5`}>
          <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div
          ref={(el) => { scroller.current = el; if (el) requestAnimationFrame(() => update(el)); }}
          onScroll={(e: UIEvent<HTMLDivElement>) => update(e.currentTarget)}
          className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-4 pt-1"
        >
          {items.map((p) => (
            <div key={p.id} className="flex w-[190px] shrink-0 snap-start sm:w-[220px] [&>*]:w-full">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
        <button type="button" onClick={() => scrollBy(1)} disabled={edges.end} aria-label={`Scroll ${title} right`} className={`${arrow} -right-5`}>
          <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </section>
  );
}
