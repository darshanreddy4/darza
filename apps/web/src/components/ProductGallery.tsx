"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type TouchEvent } from "react";
import { imgSet, imgSized, imgSrc, type ProductImage } from "@/lib/api";
import { parseVideo, type VideoInfo } from "@/lib/video";
import { ImageFallback } from "./ProductCard";
import { useSelectedOption } from "./ProductOptions";

type Item = { type: "image"; src: string; url: string; alt: string } | { type: "video"; video: VideoInfo; label: string };

const PlayIcon = ({ size = 20 }: { size?: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
);
const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
  </svg>
);

function Media({ item, fit, onZoom }: { item: Item; fit: "cover" | "contain"; onZoom?: () => void }) {
  if (item.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img {...(fit === "cover" ? imgSet(item.url, "(min-width: 1024px) 560px, 100vw", [480, 800, 1280]) : imgSet(item.url, "100vw", [800, 1280, 1600]))} alt={item.alt} draggable={false} onClick={onZoom} fetchPriority={fit === "cover" ? "high" : undefined} className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"} ${onZoom ? "cursor-zoom-in" : ""}`} />
    );
  }
  if (item.video.kind === "file") {
    return <video src={item.video.embedUrl} controls playsInline preload="metadata" className="h-full w-full bg-black object-contain" aria-label={item.label} />;
  }
  return (
    <iframe
      src={item.video.embedUrl} title={item.label} loading="lazy" allowFullScreen
      allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
      referrerPolicy="strict-origin-when-cross-origin" className="h-full w-full border-0 bg-black"
    />
  );
}

export function ProductGallery({ images, videoUrls, name }: { images: ProductImage[]; videoUrls: string[]; name: string }) {
  const items = useMemo<Item[]>(() => {
    const imgs: Item[] = images.map((i) => ({ type: "image", src: imgSrc(i.url), url: i.url, alt: i.alt ?? name }));
    const vids: Item[] = videoUrls.flatMap((u, n) => {
      const video = parseVideo(u);
      return video ? [{ type: "video" as const, video, label: `${name} — video ${n + 1}` }] : [];
    });
    return [...imgs, ...vids];
  }, [images, videoUrls, name]);

  const [index, setIndex] = useState(0);
  // Choosing a version with its own picture (a colour) shows that picture.
  const optionImage = useSelectedOption()?.imageUrl;
  const [shownFor, setShownFor] = useState(optionImage);
  if (shownFor !== optionImage) {
    setShownFor(optionImage);
    const at = optionImage ? items.findIndex((it) => it.type === "image" && it.url === optionImage) : -1;
    if (at >= 0) setIndex(at);
  }
  const [zoom, setZoom] = useState(false);
  const [touchX, setTouchX] = useState<number | null>(null);
  const count = items.length;
  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [zoom, go]);

  if (count === 0) {
    return <div className="aspect-square overflow-hidden rounded-3xl border border-line shadow-card"><ImageFallback name={name} /></div>;
  }

  const current = items[index];
  const onKeyDown = (e: KeyboardEvent) => {
    if (count < 2 || zoom) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    setTouchX(null);
  };
  const arrow = "absolute top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-lift backdrop-blur transition hover:bg-white focus-visible:opacity-100";

  return (
    <div className="flex flex-col-reverse gap-3 lg:flex-row" role="group" aria-roledescription="carousel" aria-label={`${name} media`}>
      {count > 1 && (
        <ul className="no-scrollbar flex gap-2 overflow-x-auto pb-1 lg:max-h-[620px] lg:w-[68px] lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:pb-0">
          {items.map((it, i) => (
            <li key={i} className="shrink-0">
              <button
                onClick={() => setIndex(i)}
                onMouseEnter={() => setIndex(i)}
                aria-label={it.type === "video" ? `Show video ${i - images.length + 1}` : `Show image ${i + 1}`}
                aria-current={i === index}
                className={`relative block h-16 w-16 overflow-hidden rounded-xl border-2 bg-white transition ${i === index ? "border-brand-500 shadow-card" : "border-line opacity-80 hover:opacity-100"}`}
              >
                {it.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgSized(it.url, 160)} alt="" className="h-full w-full object-cover" />
                ) : it.video.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.video.thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="block h-full w-full bg-ink-3" />
                )}
                {it.type === "video" && (
                  <span className="absolute inset-0 grid place-items-center bg-ink/40 text-white"><PlayIcon /></span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="min-w-0 flex-1">
        <div
          tabIndex={0}
          onKeyDown={onKeyDown}
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={onTouchEnd}
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${count}`}
          className="group relative aspect-square overflow-hidden rounded-3xl border border-line bg-white shadow-card outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30"
        >
          <Media key={index} item={current} fit="cover" onZoom={current.type === "image" ? () => setZoom(true) : undefined} />
          {count > 1 && (
            <>
              <button onClick={() => go(-1)} aria-label="Previous" className={`${arrow} left-3 lg:opacity-0 lg:group-hover:opacity-100`}><Chevron dir="left" /></button>
              <button onClick={() => go(1)} aria-label="Next" className={`${arrow} right-3 lg:opacity-0 lg:group-hover:opacity-100`}><Chevron dir="right" /></button>
              <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-ink/70 px-3 py-1 text-xs font-semibold text-white">{index + 1} / {count}</span>
            </>
          )}
        </div>
        {current.type === "image" && <p className="mt-2 text-center text-xs text-brand-700">Click the image to see full view</p>}
        {count > 1 && (
          <div className="mt-3 flex justify-center gap-1.5 lg:hidden" aria-hidden>
            {items.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-ink" : "w-1.5 bg-line"}`} />)}
          </div>
        )}
      </div>

      {zoom && (
        <div role="dialog" aria-modal="true" aria-label={`${name} full view`} className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-4" onClick={() => setZoom(false)}>
          <button onClick={() => setZoom(false)} aria-label="Close" className="absolute right-5 top-5 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20">×</button>
          <div className="relative h-full max-h-[90vh] w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <Media item={current} fit="contain" />
          </div>
          {count > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous" className={`${arrow} left-5`}><Chevron dir="left" /></button>
              <button onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next" className={`${arrow} right-5`}><Chevron dir="right" /></button>
              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">{index + 1} / {count}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
