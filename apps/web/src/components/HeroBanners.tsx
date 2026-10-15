"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { API_URL, imgSet, imgSrc } from "@/lib/api";
import { parseVideo } from "@/lib/video";
import { DEFAULT_TEXT_POSITION, isBannerPosition, splitPosition, type BannerPosition } from "@/lib/banner-position";
import { Countdown, useNow } from "./Countdown";

export interface BannerData {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  ctaLabel: string | null;
  linkUrl: string | null;
  textTone: "LIGHT" | "DARK";
  // Present only when the banner shows a countdown.
  endsAt?: string | null;
  serverNow?: string;
  videoUrl?: string | null;
  sponsorName?: string | null;
  textPosition?: string | null;
  // Null puts the button under the text.
  buttonPosition?: string | null;
}

const isExternal = (url: string) => /^https:\/\//.test(url);
const MOTION = "(prefers-reduced-motion: reduce)";

// Autoplaying video is skipped for people who asked for reduced motion or data saving; they get the cover image.
function useVideoAllowed() {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(MOTION); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => !window.matchMedia(MOTION).matches && !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
    () => false,
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H3v6h3l5 4z" />
      {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12" />}
    </svg>
  );
}

const youtubeIdOf = (url?: string | null) => {
  const v = url ? parseVideo(url) : null;
  return v?.kind === "youtube" ? v.id : null;
};

// Muted autoplay embed; the IFrame API over postMessage gives us sound control and the "ended" signal.
function YouTubeFrame({ id, muted, loop, onEnd, onError }: { id: string; muted: boolean; loop: boolean; onEnd: () => void; onError: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [origin] = useState(() => encodeURIComponent(window.location.origin));
  const send = (func: string) => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "https://www.youtube-nocookie.com");

  useEffect(() => { if (loaded) send(muted ? "mute" : "unMute"); }, [muted, loaded]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== "string") return;
      let msg: { event?: string; info?: unknown };
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.event === "onStateChange" && msg.info === 0) onEnd();
      if (msg.event === "onError") onError();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onEnd, onError]);

  const params = `autoplay=1&mute=1&controls=0&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&enablejsapi=1&origin=${origin}${loop ? `&loop=1&playlist=${id}` : ""}`;
  return (
    <div className="absolute inset-0 overflow-hidden [container-type:size]">
      <iframe
        ref={frame} title="Sponsored video" tabIndex={-1} aria-hidden allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin"
        src={`https://www.youtube-nocookie.com/embed/${id}?${params}`}
        onLoad={() => { setLoaded(true); frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "https://www.youtube-nocookie.com"); }}
        className={`pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 border-0 transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{ width: "max(100cqw, 177.78cqh)", height: "max(100cqh, 56.25cqw)" }}
      />
    </div>
  );
}

const buttonCls = (light: boolean) => `inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-semibold shadow-lg ${light ? "bg-white text-ink" : "bg-ink text-white"}`;

// Darkens (or lightens) the side the text sits on so it stays readable; vertical placement needs no extra help.
function scrim(pos: BannerPosition, light: boolean) {
  const { h } = splitPosition(pos);
  if (h === "center") return light ? "bg-ink/55" : "bg-white/65";
  const dir = h === "left" ? "bg-linear-to-r" : "bg-linear-to-l";
  return `${dir} ${light ? "from-ink/80 via-ink/40" : "from-white/90 via-white/50"} to-transparent`;
}

// Padding keeps content clear of the Ad label (top), sound button (top right), arrows (sides) and dots (bottom).
function PositionBox({ pos, light, children }: { pos: BannerPosition; light: boolean; children: React.ReactNode }) {
  const { v, h } = splitPosition(pos);
  const vert = v === "top" ? "items-start" : v === "bottom" ? "items-end" : "items-center";
  const horiz = h === "left" ? "justify-start text-left" : h === "right" ? "justify-end text-right" : "justify-center text-center";
  const align = h === "left" ? "items-start" : h === "right" ? "items-end" : "items-center";
  return (
    <div className={`pointer-events-none absolute inset-0 z-[2] flex px-8 pb-12 pt-16 sm:px-20 ${vert} ${horiz} ${light ? "text-white" : "text-ink"}`}>
      <div className={`flex min-w-0 max-w-full flex-col gap-2.5 sm:gap-3 ${align}`}>{children}</div>
    </div>
  );
}

function Slide({ b, active, priority, msLeft, playVideo, loopVideo, onClick, onVideoEnd, onVideoError }: {
  b: BannerData; active: boolean; priority: boolean; msLeft: number | null; playVideo: boolean; loopVideo: boolean;
  onClick: () => void; onVideoEnd: () => void; onVideoError: () => void;
}) {
  const light = b.textTone === "LIGHT";
  const [muted, setMuted] = useState(true);
  const showVideo = !!b.videoUrl && active && playVideo;
  const ytId = youtubeIdOf(b.videoUrl);

  const textPos: BannerPosition = isBannerPosition(b.textPosition) ? b.textPosition : DEFAULT_TEXT_POSITION;
  const buttonPos: BannerPosition = isBannerPosition(b.buttonPosition) ? b.buttonPosition : textPos;
  const hasText = !!(b.title || b.subtitle || msLeft !== null);
  const hasButton = !!(b.linkUrl && b.ctaLabel);
  const together = buttonPos === textPos;
  const label = b.title || b.sponsorName || "Learn more";

  const button = hasButton && (
    <div className="pointer-events-auto relative mt-1 w-fit sm:mt-2">
      {isExternal(b.linkUrl!) ? (
        <a href={b.linkUrl!} target="_blank" rel="noopener noreferrer sponsored nofollow" onClick={onClick} className={buttonCls(light)}>{b.ctaLabel}<span aria-hidden className="ml-1.5">↗</span></a>
      ) : (
        <Link href={b.linkUrl!} onClick={onClick} className={buttonCls(light)}>{b.ctaLabel}</Link>
      )}
    </div>
  );

  return (
    <div className={`absolute inset-0 transition-opacity duration-700 ${active ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!active} inert={!active}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {ytId && <img src={imgSrc(b.imageUrl)} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />}
      {showVideo && ytId ? (
        <YouTubeFrame id={ytId} muted={muted} loop={loopVideo} onEnd={onVideoEnd} onError={onVideoError} />
      ) : showVideo ? (
        <video
          src={imgSrc(b.videoUrl!)} poster={imgSrc(b.imageUrl)} autoPlay muted={muted} playsInline loop={loopVideo} preload="metadata"
          onEnded={onVideoEnd} onError={onVideoError} aria-hidden className="h-full w-full object-cover"
        />
      ) : !ytId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img {...imgSet(b.imageUrl, "100vw", [640, 1280, 1600])} alt="" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} draggable={false} className="h-full w-full object-cover" />
      )}
      {hasText && <div className={`absolute inset-0 ${scrim(textPos, light)}`} />}

      {/* Without a button label the whole banner is the link, which suits text-free image or video ads. */}
      {b.linkUrl && !b.ctaLabel && (isExternal(b.linkUrl) ? (
        <a href={b.linkUrl} target="_blank" rel="noopener noreferrer sponsored nofollow" onClick={onClick} aria-label={label} className="absolute inset-0 z-[1]" />
      ) : (
        <Link href={b.linkUrl} onClick={onClick} aria-label={label} className="absolute inset-0 z-[1]" />
      ))}

      {b.sponsorName && (
        <span className="absolute left-4 top-4 z-10 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur sm:left-6 sm:top-5" aria-label={`Advertisement from ${b.sponsorName}`}>
          Ad · {b.sponsorName}
        </span>
      )}
      {showVideo && (
        <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Turn sound on" : "Turn sound off"} aria-pressed={!muted}
          className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/75 sm:right-6 sm:top-5">
          <SpeakerIcon muted={muted} />
        </button>
      )}

      {(hasText || (together && hasButton)) && (
        <PositionBox pos={textPos} light={light}>
          {b.title && <h2 className="max-w-xl text-2xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">{b.title}</h2>}
          {b.subtitle && <p className={`max-w-lg text-sm sm:text-base ${light ? "text-white/85" : "text-ink/75"}`}>{b.subtitle}</p>}
          {msLeft !== null && <Countdown msLeft={msLeft} tone={b.textTone} />}
          {together && button}
        </PositionBox>
      )}
      {!together && hasButton && <PositionBox pos={buttonPos} light={light}>{button}</PositionBox>}
    </div>
  );
}

export function HeroBanners({ banners }: { banners: BannerData[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [touchX, setTouchX] = useState<number | null>(null);
  const [inView, setInView] = useState(false);
  const [failedVideos, setFailedVideos] = useState<string[]>([]);
  const section = useRef<HTMLElement>(null);
  const counted = useRef(new Set<string>());
  const videoAllowed = useVideoAllowed();

  const clock = useNow(1000, banners.some((b) => b.endsAt));
  // With serverNow, count down from the server-computed duration so a wrong device clock doesn't matter; without it (admin preview) use the device clock.
  const msLeftFor = (b: BannerData): number | null => {
    if (!b.endsAt || !clock) return null;
    if (!b.serverNow) return Date.parse(b.endsAt) - clock.now;
    return Date.parse(b.endsAt) - Date.parse(b.serverNow) - (clock.now - clock.start);
  };
  const visible = banners.filter((b) => { const left = msLeftFor(b); return left === null || left > 0; });

  const count = visible.length;
  const current = count ? index % count : 0;
  const currentBanner = visible[current];
  const go = (d: number) => setIndex((i) => (i % count + d + count) % count);
  const playsVideo = (b?: BannerData) => !!b?.videoUrl && videoAllowed && !failedVideos.includes(b.id);
  // A playing video advances the carousel when it ends; otherwise a timer does.
  const videoDrivesAdvance = playsVideo(currentBanner) && count > 1;

  useEffect(() => {
    if (count < 2 || paused || userPaused || videoDrivesAdvance) return;
    if (window.matchMedia(MOTION).matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(t);
  }, [count, paused, userPaused, videoDrivesAdvance]);

  // Safety net so a stalled or very long video can't pin the carousel forever.
  useEffect(() => {
    if (!videoDrivesAdvance || userPaused) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), 75_000);
    return () => clearTimeout(t);
  }, [videoDrivesAdvance, userPaused, current, count]);

  const hasBanners = count > 0;
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.5), { threshold: [0, 0.5] });
    io.observe(el);
    return () => io.disconnect();
  }, [hasBanners]);

  // One impression per banner per page view, counted once it is actually on screen.
  const currentId = currentBanner?.id;
  useEffect(() => {
    if (!inView || !currentId || currentId === "preview" || counted.current.has(currentId)) return;
    counted.current.add(currentId);
    navigator.sendBeacon?.(`${API_URL}/banners/${currentId}/impression`);
  }, [inView, currentId]);

  if (count === 0) return null;

  const track = (id: string) => { if (id !== "preview") navigator.sendBeacon?.(`${API_URL}/banners/${id}/click`); };
  const arrow = "absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-lift transition hover:bg-white sm:grid";

  return (
    <section
      ref={section}
      aria-roledescription="carousel" aria-label="Featured offers"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX !== null && count > 1) { const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }
        setTouchX(null);
      }}
      className="group relative aspect-[4/3] overflow-hidden rounded-3xl bg-ink shadow-card sm:aspect-[2/1] lg:aspect-[8/3]"
    >
      <div aria-live={paused || userPaused ? "polite" : "off"}>
        {visible.map((b, i) => (
          <Slide
            key={b.id} b={b} active={i === current} priority={i === 0} msLeft={msLeftFor(b)}
            playVideo={playsVideo(b)} loopVideo={count === 1} onClick={() => track(b.id)}
            onVideoEnd={() => { if (!userPaused) go(1); }} onVideoError={() => setFailedVideos((f) => [...f, b.id])}
          />
        ))}
      </div>

      {count > 1 && (
        <>
          <button onClick={() => go(-1)} aria-label="Previous banner" className={`${arrow} left-4`}>
            <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button onClick={() => go(1)} aria-label="Next banner" className={`${arrow} right-4`}>
            <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
          </button>
          <div className="absolute inset-x-0 bottom-4 z-10 flex items-center justify-center gap-2">
            {visible.map((b, i) => (
              <button key={b.id} onClick={() => setIndex(i)} aria-label={`Show banner ${i + 1}${b.title ? `: ${b.title}` : ""}`} aria-current={i === current}
                className={`h-2 rounded-full transition-all ${i === current ? "w-7 bg-white" : "w-2 bg-white/50 hover:bg-white/80"}`} />
            ))}
            <button onClick={() => setUserPaused((p) => !p)} aria-label={userPaused ? "Resume autoplay" : "Pause autoplay"} className="ml-2 grid h-6 w-6 place-items-center rounded-full bg-white/80 text-ink">
              <svg aria-hidden width="10" height="10" viewBox="0 0 24 24" fill="currentColor">{userPaused ? <path d="M6 4l14 8-14 8z" /> : <path d="M6 4h4v16H6zM14 4h4v16h-4z" />}</svg>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
