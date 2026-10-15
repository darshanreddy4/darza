"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { AdsenseConfig } from "@/lib/home";

const WIDE = "(min-width: 1700px)";
const isDev = process.env.NODE_ENV !== "production";

function useWideScreen() {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(WIDE); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}

// Google's loader is added once per page, however many ads there are.
function loadAdsense(publisherId: string) {
  const id = `adsbygoogle-js-${publisherId}`;
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
  document.head.appendChild(s);
}

function AdUnit({ c, status, setStatus }: { c: AdsenseConfig; status: string; setStatus: (s: string) => void }) {
  const ins = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    const el = ins.current;
    if (!el || pushed.current) return;
    pushed.current = true;
    loadAdsense(c.publisherId);
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch { /* an ad that cannot load just stays empty */ }

    const watch = new MutationObserver(() => setStatus(el.getAttribute("data-ad-status") ?? "pending"));
    watch.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });
    return () => watch.disconnect();
  }, [c.publisherId, setStatus]);

  const fixed = !c.format && c.width > 0 && c.height > 0;
  const style: CSSProperties = fixed ? { display: "inline-block", width: c.width, height: c.height } : { display: "block" };

  return (
    <>
      <ins
        ref={ins}
        className="adsbygoogle"
        style={style}
        data-ad-client={c.publisherId}
        data-ad-slot={c.slotId}
        data-ad-format={c.format || undefined}
        data-ad-layout={c.layout || undefined}
        data-ad-layout-key={c.layoutKey || undefined}
        data-full-width-responsive={c.format ? String(c.responsive) : undefined}
        data-adtest={c.testMode ? "on" : undefined}
      />
      {isDev && status !== "filled" && (
        <div className="grid min-h-24 place-items-center rounded-lg border border-dashed border-line bg-canvas px-4 text-center text-xs text-muted" style={fixed ? { width: c.width, height: c.height, maxWidth: "100%" } : undefined}>
          Ad space. Real ads appear once your site is approved in AdSense{c.testMode ? "." : ", or switch on test mode."}
        </div>
      )}
    </>
  );
}

export function AdsenseSlot({ config: c }: { config: AdsenseConfig }) {
  const wide = useWideScreen();
  const [closed, setClosed] = useState(false);
  const [status, setStatus] = useState("pending");
  if (!c.publisherId || !c.slotId) return null;
  // Nothing to sell to this visitor: leave no empty frame or label behind.
  if (status === "unfilled" && !isDev) return null;
  const unit = <AdUnit c={c} status={status} setStatus={setStatus} />;

  const label = c.showLabel && <p className="mb-1 text-center text-[11px] uppercase tracking-wider text-muted">Advertisement</p>;

  if (c.placement === "left-rail" || c.placement === "right-rail") {
    if (!wide) return null;
    return (
      <aside aria-label="Advertisement" className={`fixed top-44 z-30 w-40 ${c.placement === "left-rail" ? "left-3" : "right-3"}`}>
        {label}
        {unit}
      </aside>
    );
  }

  if (c.placement === "bottom-bar") {
    if (closed) return null;
    return (
      <aside aria-label="Advertisement" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-3 py-2 shadow-lift backdrop-blur">
        <button type="button" onClick={() => setClosed(true)} aria-label="Close advertisement" className="absolute right-2 top-1 grid h-6 w-6 place-items-center rounded-full bg-canvas text-sm text-ink-3 hover:bg-line">×</button>
        <div className="mx-auto max-w-5xl text-center">
          {label}
          {unit}
        </div>
      </aside>
    );
  }

  return (
    <section aria-label="Advertisement" className="mx-auto w-full max-w-5xl overflow-hidden text-center">
      {label}
      {unit}
    </section>
  );
}
