"use client";

import { useState, type FormEvent } from "react";
import { useAdminApi } from "@/lib/admin";
import { barSkin, chromeWarnings, navSkin, searchSkin, STANDARD, type ChromeSection, type ChromeStyle } from "@/lib/chrome";
import { ImageField } from "@/components/admin/ImageField";
import { Alert, Card, btn, inputCls } from "@/components/admin/ui";

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const full = (v: string) => (v.length === 4 ? `#${v.slice(1).split("").map((c) => c + c).join("")}` : v).toLowerCase();

type Draft = Record<string, string>;

const SECTIONS = [
  { key: "header", title: "Header", hint: "The dark bar with the logo, search, currency, wishlist, cart and login.", colors: [["bg", "Background colour", STANDARD.header], ["fg", "Text colour", ""]], image: true },
  { key: "search", title: "Search bar", hint: "The box customers type in.", colors: [["bg", "Background colour", STANDARD.search], ["fg", "Text colour", ""], ["button", "Button colour", STANDARD.button], ["buttonFg", "Icon colour", ""]], image: false },
  { key: "nav", title: "Category bar", hint: "The white row of categories under the header.", colors: [["bg", "Background colour", STANDARD.nav], ["fg", "Text colour", ""]], image: false },
  { key: "footer", title: "Footer", hint: "The bar at the bottom of every page.", colors: [["bg", "Background colour", STANDARD.footer], ["fg", "Text colour", ""]], image: true },
] as const;

const toDraft = (c: ChromeStyle): Draft => {
  const d: Draft = {};
  for (const s of SECTIONS) {
    const sec = c[s.key] as ChromeSection | undefined;
    for (const [k] of s.colors) d[`${s.key}.${k}`] = (sec?.[k as keyof ChromeSection] as string | undefined) ?? "";
    if (s.image) { d[`${s.key}.image`] = sec?.image ?? ""; d[`${s.key}.overlay`] = String(sec?.overlay ?? 55); }
  }
  return d;
};

// The draft as the shop would use it; entries that are not colours yet (half typed) are left out.
function toChrome(d: Draft): ChromeStyle {
  const out: ChromeStyle = {};
  for (const s of SECTIONS) {
    const sec: ChromeSection = {};
    for (const [k] of s.colors) { const v = d[`${s.key}.${k}`]?.trim(); if (v && HEX.test(v)) (sec as Record<string, string>)[k] = full(v); }
    if (s.image) {
      const image = d[`${s.key}.image`]?.trim();
      if (image) { sec.image = image; const o = Number(d[`${s.key}.overlay`]); if (Number.isInteger(o) && o >= 0 && o <= 90) sec.overlay = o; }
    }
    if (Object.keys(sec).length) (out as Record<string, ChromeSection>)[s.key] = sec;
  }
  return out;
}

function ColorField({ label, value, onChange, fallback }: { label: string; value: string; onChange: (v: string) => void; fallback: string }) {
  const bad = value.trim() !== "" && !HEX.test(value.trim());
  return (
    <div>
      <label className="block text-sm font-medium" htmlFor={`chrome-${label}`}>{label}</label>
      <div className="mt-1.5 flex items-center gap-2">
        <input type="color" aria-label={`${label}, colour picker`} value={HEX.test(value.trim()) ? full(value.trim()) : fallback || "#000000"} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-white p-1" />
        <input id={`chrome-${label}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={fallback ? "Standard" : "Auto"} maxLength={7} aria-invalid={bad} className={`${inputCls} font-mono ${bad ? "!border-red-400" : ""}`} />
        <button type="button" onClick={() => onChange("")} disabled={!value} className={`${btn.secondary} !px-3`} aria-label={`Reset ${label}`}>Reset</button>
      </div>
      {bad && <p className="mt-1 text-xs text-red-600">Use a colour like #1e3a8a.</p>}
    </div>
  );
}

// A small copy of the header, category bar and footer drawn with the same rules the shop uses, so what is shown here is what shoppers get.
function Preview({ chrome, brand }: { chrome: ChromeStyle; brand: string }) {
  const bar = barSkin(chrome.header, STANDARD.header);
  const search = searchSkin(chrome.search);
  const nav = navSkin(chrome.nav);
  const foot = barSkin(chrome.footer, STANDARD.footer, true);
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-2xl border border-line text-left">
      <div data-chrome="bar" data-custom={bar ? "" : undefined} style={bar?.style} className="bg-ink">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="font-display text-lg font-extrabold tracking-[0.12em] text-white">{brand.toUpperCase()}</span>
          <div role="search" data-search-custom={search ? "" : undefined} style={search?.style} className="flex min-w-48 flex-1 rounded-xl bg-white">
            <span className="flex-1 px-4 py-2 text-sm text-muted">Search products, brands and categories</span>
            <button type="button" tabIndex={-1} aria-label="Search" className="rounded-r-xl bg-brand-500 px-4 text-ink">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            </button>
          </div>
          <span className="rounded-xl bg-ink-3 px-3 py-2 text-sm font-semibold text-white">INR</span>
          <span className="px-2 text-sm font-medium text-white/90">Cart</span>
          <span className="px-2 text-sm font-medium text-white/90">Log in</span>
        </div>
      </div>
      <div data-custom-nav={nav ? "" : undefined} style={nav?.style} className="border-b border-line bg-white px-4">
        <span className="flex gap-1">
          {["All products", "Sold by " + brand, "Electronics", "Lifestyle"].map((t) => <span key={t} data-nav-link className="border-b-2 border-transparent px-3 py-3 text-sm font-medium text-ink-3">{t}</span>)}
        </span>
      </div>
      <div data-chrome="footer" data-custom={foot ? "" : undefined} style={foot?.style} className="bg-ink text-white/70">
        <div className="grid gap-6 px-4 py-6 sm:grid-cols-3">
          <div><span className="font-display text-lg font-extrabold tracking-[0.12em] text-white">{brand.toUpperCase()}</span><p className="mt-2 text-xs">A curated shopping destination.</p></div>
          <div><p className="text-sm font-semibold text-white">Shop</p><p className="mt-2 text-xs">All products</p><p className="text-xs">Your cart</p></div>
          <div><p className="text-sm font-semibold text-white">Customer care</p><p className="mt-2 text-xs">support@example.com</p></div>
        </div>
        <div className="border-t border-white/10 px-4 py-3 text-xs">&copy; {new Date().getFullYear()} {brand}. All rights reserved.</div>
      </div>
    </div>
  );
}

export function ChromeForm({ initial, brand, onSaved }: { initial: ChromeStyle; brand: string; onSaved: () => void }) {
  const call = useAdminApi();
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const set = (key: string) => (v: string) => setDraft((d) => ({ ...d, [key]: v }));

  const chrome = toChrome(draft);
  const warnings = chromeWarnings(chrome);
  const customised = Object.keys(toChrome(toDraft(initial))).length > 0;

  async function send(body: ChromeStyle, message: string) {
    setError(""); setNotice(""); setBusy(true);
    try {
      await call("/admin/appearance", { method: "PUT", body: JSON.stringify({ chrome: body }) });
      setNotice(message);
      onSaved();
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    for (const s of SECTIONS) for (const [k, label] of s.colors) {
      const v = draft[`${s.key}.${k}`]?.trim();
      if (v && !HEX.test(v)) return setError(`${s.title}, ${label.toLowerCase()}: use a colour like #1e3a8a.`);
    }
    void send(chrome, "Saved. The header, search bar and footer now use these colours.");
  }

  function reset() {
    setDraft(toDraft({}));
    void send({}, "Back to the standard colours.");
  }

  return (
    <Card title="Header, search bar and footer" description="Pick any colour for the header, search bar, category bar and footer, and a picture behind the header and footer. Leave a text colour empty (Auto) and a readable one is chosen for you. This sits on top of the store look above.">
      <form onSubmit={save} className="space-y-6">
        <Preview chrome={chrome} brand={brand} />

        <div className="grid gap-6 lg:grid-cols-2">
          {SECTIONS.map((s) => (
            <fieldset key={s.key} className="space-y-3 rounded-2xl border border-line p-4">
              <legend className="px-1 text-sm font-semibold">{s.title}</legend>
              <p className="-mt-1 text-xs text-muted">{s.hint}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {s.colors.map(([k, label, fallback]) => (
                  <ColorField key={k} label={`${s.title} ${label.toLowerCase()}`} value={draft[`${s.key}.${k}`] ?? ""} onChange={set(`${s.key}.${k}`)} fallback={fallback} />
                ))}
              </div>
              {s.image && (
                <div className="space-y-2">
                  <ImageField name={`${s.title} picture (optional)`} value={draft[`${s.key}.image`] ?? ""} onChange={set(`${s.key}.image`)} />
                  {draft[`${s.key}.image`] && (
                    <label className="block text-sm font-medium">{s.title} picture tint: {draft[`${s.key}.overlay`]}%
                      <input type="range" min={0} max={90} step={5} value={draft[`${s.key}.overlay`] ?? "55"} onChange={(e) => set(`${s.key}.overlay`)(e.target.value)} className="mt-1.5 block w-full accent-emerald-600" aria-label={`${s.title} picture tint`} />
                      <span className="mt-1 block text-xs font-normal text-muted">A layer of the background colour over the picture so the text stays readable. Higher is plainer, lower shows more picture.</span>
                    </label>
                  )}
                </div>
              )}
            </fieldset>
          ))}
        </div>

        {warnings.length > 0 && (
          <div role="status" className="space-y-1 rounded-xl bg-gold-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Check these before saving</p>
            <ul className="list-disc space-y-1 pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        )}
        {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
        {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}

        <div className="flex flex-wrap gap-3">
          <button disabled={busy} className={btn.primary}>{busy ? "Saving…" : "Save colours"}</button>
          <button type="button" disabled={busy || (!customised && Object.keys(chrome).length === 0)} onClick={reset} className={btn.secondary}>Back to standard colours</button>
        </div>
      </form>
    </Card>
  );
}
