"use client";

import Link from "next/link";
import { Children, useRef, useState, type ReactNode, type UIEvent } from "react";

// Fixed class names so Tailwind can see them. Gaps are 1rem: each item is (100% - gaps) / items wide.
const WIDTH: Record<number, string> = {
  2: "lg:w-[calc((100%-1rem)/2)]",
  3: "lg:w-[calc((100%-2rem)/3)]",
  4: "lg:w-[calc((100%-3rem)/4)]",
  5: "lg:w-[calc((100%-4rem)/5)]",
  6: "lg:w-[calc((100%-5rem)/6)]",
};

// One row that slides sideways: `perView` items fit on large screens, the rest come in with the arrows or a swipe.
export function SlideRow({ title, subtitle, href, label, perView, children }: { title?: string; subtitle?: string; href?: string; label: string; perView: number; children: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const items = Children.toArray(children);
  if (items.length === 0) return null;

  const update = (el: HTMLElement) => {
    const next = { start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 };
    setEdges((cur) => (cur.start === next.start && cur.end === next.end ? cur : next));
  };
  const page = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * (scroller.current.clientWidth + 16), behavior: "smooth" });
  const everythingFits = edges.start && edges.end;
  const arrow = "absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-white text-ink shadow-lift transition hover:bg-canvas disabled:pointer-events-none disabled:opacity-0 md:grid";

  return (
    <section aria-label={label}>
      {(title || subtitle || href) && (
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            {title && <h2 className="text-2xl font-bold">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          {href && <Link href={href} className="shrink-0 text-sm font-semibold text-brand-700 hover:underline">View all →</Link>}
        </div>
      )}
      <div className="relative">
        {!everythingFits && (
          <button type="button" onClick={() => page(-1)} disabled={edges.start} aria-label={`Previous ${label}`} className={`${arrow} -left-5`}>
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        )}
        <div
          ref={(el) => { scroller.current = el; if (el) requestAnimationFrame(() => update(el)); }}
          onScroll={(e: UIEvent<HTMLDivElement>) => update(e.currentTarget)}
          className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-1 pb-3 pt-1"
        >
          {items.map((item, i) => (
            <div key={i} className={`flex w-[78%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] [&>*]:w-full ${WIDTH[perView] ?? WIDTH[4]}`}>{item}</div>
          ))}
        </div>
        {!everythingFits && (
          <button type="button" onClick={() => page(1)} disabled={edges.end} aria-label={`Next ${label}`} className={`${arrow} -right-5`}>
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        )}
      </div>
    </section>
  );
}
