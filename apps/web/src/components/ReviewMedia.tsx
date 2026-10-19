"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { imgSized, imgSrc } from "@/lib/api";

export interface MediaItem { id?: string; type: "IMAGE" | "VIDEO"; url: string }

const Play = () => (
  <span aria-hidden className="absolute inset-0 grid place-items-center bg-black/25 text-white">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
  </span>
);

// Pictures and videos from reviews as small tiles. A tile opens the full-size viewer, and a last tile can lead to everything.
export function MediaThumbs({ items, size = 64, more = 0, moreHref, label = "Customer photos and videos" }: { items: MediaItem[]; size?: number; more?: number; moreHref?: string; label?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  if (items.length === 0) return null;
  const box = { width: size, height: size };
  return (
    <>
      <ul className="flex flex-wrap gap-2" aria-label={label}>
        {items.map((m, i) => (
          <li key={m.id ?? m.url}>
            <button type="button" onClick={() => setOpen(i)} style={box} aria-label={`${m.type === "VIDEO" ? "Play video" : "View photo"} ${i + 1} of ${items.length}`}
              className="relative block overflow-hidden rounded-lg border border-line bg-canvas transition hover:border-ink">
              {m.type === "VIDEO"
                ? <video src={`${imgSrc(m.url)}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={imgSized(m.url, 320)} alt="" loading="lazy" className="h-full w-full object-cover" />}
              {m.type === "VIDEO" && <Play />}
            </button>
          </li>
        ))}
        {more > 0 && moreHref && (
          <li>
            <Link href={moreHref} style={box} className="grid place-items-center rounded-lg border border-line bg-canvas text-sm font-bold hover:border-ink" aria-label={`See ${more} more photos and videos`}>+{more}</Link>
          </li>
        )}
      </ul>
      {open !== null && <MediaViewer items={items} start={open} onClose={close} />}
    </>
  );
}

function MediaViewer({ items, start, onClose }: { items: MediaItem[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const box = useRef<HTMLDivElement>(null);
  const step = useCallback((d: number) => setIndex((i) => (i + d + items.length) % items.length), [items.length]);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("button")?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", keys);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", keys); document.body.style.overflow = overflow; before?.focus(); };
  }, [onClose, step]);

  const m = items[index];
  const arrow = "absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-lift hover:bg-white";
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/90 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={`Customer ${m.type === "VIDEO" ? "video" : "photo"} ${index + 1} of ${items.length}`} className="relative flex max-h-full w-full max-w-4xl items-center justify-center">
        {m.type === "VIDEO"
          ? <video key={m.url} src={imgSrc(m.url)} controls autoPlay playsInline className="max-h-[85vh] w-auto max-w-full rounded-xl bg-black" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img key={m.url} src={imgSized(m.url, 1280)} alt="" className="max-h-[85vh] w-auto max-w-full rounded-xl object-contain" />}
        <button type="button" onClick={onClose} aria-label="Close" className="absolute -top-2 right-0 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-xl font-bold text-ink hover:bg-white sm:-right-12 sm:top-0">×</button>
        {items.length > 1 && (
          <>
            <button type="button" onClick={() => step(-1)} aria-label="Previous" className={`${arrow} left-2`}>‹</button>
            <button type="button" onClick={() => step(1)} aria-label="Next" className={`${arrow} right-2`}>›</button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
