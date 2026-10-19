"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const ShareIcon = () => (
  <svg aria-hidden width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

// Share a product page link. On a phone the share sheet opens; elsewhere the link is copied (cards) or a small menu opens (product page).
export function ShareButton({ slug, title, className = "", label = false, menu = false }: { slug: string; title: string; className?: string; label?: boolean; menu?: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [toast, setToast] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const link = () => `${window.location.origin}/products/${encodeURIComponent(slug)}`;

  async function copy(target: string) {
    if (await copyText(target)) setToast("Link copied");
    else window.prompt("Copy this link", target);
  }

  async function press() {
    const target = link();
    setUrl(target);
    if (typeof navigator.share === "function") {
      try { await navigator.share({ title, text: `Have a look at ${title}`, url: target }); return; }
      catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    if (menu) setOpen((o) => !o);
    else await copy(target);
  }

  const text = encodeURIComponent(`Have a look at ${title}`);
  const enc = encodeURIComponent(url);
  const targets = [
    ["WhatsApp", `https://wa.me/?text=${text}%20${enc}`],
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${enc}`],
    ["X", `https://twitter.com/intent/tweet?text=${text}&url=${enc}`],
    ["Telegram", `https://t.me/share/url?url=${enc}&text=${text}`],
    ["Email", `mailto:?subject=${encodeURIComponent(title)}&body=${text}%20${enc}`],
  ] as const;

  return (
    <div ref={box} className="relative inline-block">
      <button type="button" onClick={press} aria-label={label ? undefined : "Share this product"} aria-haspopup={menu ? "true" : undefined} aria-expanded={menu ? open : undefined}
        className={`inline-flex items-center justify-center gap-2 rounded-full text-ink-3 transition hover:text-brand-700 ${className}`}>
        <ShareIcon />
        {label && <span className="text-sm font-medium">Share</span>}
      </button>
      {menu && open && (
        <div role="group" aria-label="Share this product" className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-line bg-white p-4 shadow-lift">
          <p className="text-sm font-semibold">Share this product</p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={url} aria-label="Product link" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-xs" />
            <button type="button" onClick={() => copy(url)} className="shrink-0 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-ink-3">Copy link</button>
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {targets.map(([name, href]) => (
              <li key={name}>
                <a href={href} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-line px-2 py-2 text-center text-xs font-medium hover:border-brand-500 hover:text-brand-700">{name}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {toast && typeof document !== "undefined" && createPortal(
        <div role="status" className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-lift">{toast}</div>,
        document.body,
      )}
    </div>
  );
}
