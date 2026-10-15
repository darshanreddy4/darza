"use client";

import { useState, type ReactNode } from "react";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { adsenseSummary, parseAdsenseCode } from "@/lib/adsense";
import { ADSENSE_PLACEMENTS, PRODUCT_SOURCES, TRUST_ICONS, TRUST_ICON_LABELS, type WidgetType } from "@/lib/home";
import { btn, inputCls } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/ImageField";

type Config = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
interface EditorProps { config: Config; set: (patch: Config) => void }

const label = "block text-sm font-medium";
const hint = "mt-1 block text-xs font-normal text-muted";

function Field({ name, hint: h, children }: { name: string; hint?: string; children: ReactNode }) {
  return <label className={label}>{name}<span className="mt-1.5 block">{children}</span>{h && <span className={hint}>{h}</span>}</label>;
}

function Text({ name, value, onChange, max, placeholder, hint: h, multiline }: { name: string; value: string; onChange: (v: string) => void; max?: number; placeholder?: string; hint?: string; multiline?: boolean }) {
  return (
    <Field name={name} hint={h}>
      {multiline
        ? <textarea className={inputCls} rows={4} maxLength={max} placeholder={placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        : <input className={inputCls} maxLength={max} placeholder={placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

function Choice<T extends string | number>({ name, value, options, onChange, hint: h }: { name: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; hint?: string }) {
  return (
    <Field name={name} hint={h}>
      <select className={inputCls} value={value} onChange={(e) => onChange((typeof value === "number" ? Number(e.target.value) : e.target.value) as T)}>
        {options.map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

function Count({ name, value, min, max, onChange, hint: h }: { name: string; value: number; min: number; max: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <Field name={name} hint={h}>
      <input type="number" className={inputCls} min={min} max={max} value={value ?? min} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))} />
    </Field>
  );
}

// A list the admin can add to, reorder and remove from.
function ListEditor<T>({ items, onChange, max, addLabel, blank, render, noun }: { items: T[]; onChange: (items: T[]) => void; max: number; addLabel: string; blank: T; noun: string; render: (item: T, update: (patch: Partial<T>) => void) => ReactNode }) {
  const move = (i: number, d: -1 | 1) => { const next = [...items]; const j = i + d; if (j < 0 || j >= next.length) return; [next[i], next[j]] = [next[j], next[i]]; onChange(next); };
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-line bg-canvas/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">{noun} {i + 1}</span>
            <span className="flex gap-1">
              <button type="button" className={btn.secondary + " !px-2 !py-1"} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${noun} ${i + 1} up`}>↑</button>
              <button type="button" className={btn.secondary + " !px-2 !py-1"} disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${noun} ${i + 1} down`}>↓</button>
              <button type="button" className={btn.danger + " !py-1"} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove ${noun} ${i + 1}`}>Remove</button>
            </span>
          </div>
          <div className="space-y-3">{render(item, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}</div>
        </div>
      ))}
      {items.length < max && <button type="button" className={btn.secondary} onClick={() => onChange([...items, blank])}>{addLabel}</button>}
    </div>
  );
}

function ProductsEditor({ config, set, slider = false }: EditorProps & { slider?: boolean }) {
  const categories = useAdminQuery<{ id: string; name: string; slug: string }[]>("/admin/categories");
  const call = useAdminApi();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ slug: string; name: string }[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const picks: string[] = config.picks ?? [];

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) return setResults([]);
    const rows = await call<{ slug: string; name: string; status: string }[]>(`/admin/products?q=${encodeURIComponent(q.trim())}`).catch(() => []);
    setNames((cur) => ({ ...cur, ...Object.fromEntries(rows.map((r) => [r.slug, r.name])) }));
    setResults(rows.filter((r) => r.status === "PUBLISHED" && !picks.includes(r.slug)).slice(0, 8));
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Text name="Heading" value={config.title} onChange={(v) => set({ title: v })} max={80} />
      <Text name="Small text under the heading" value={config.subtitle} onChange={(v) => set({ subtitle: v })} max={160} />
      <Choice name="Which products" value={config.source} options={PRODUCT_SOURCES.map((s) => ({ value: s.value, label: s.label }))} onChange={(v) => set({ source: v })} hint="Best sellers use paid orders; top rated uses customer reviews." />
      {config.source === "category" && (
        <Choice name="Category" value={config.category} options={[{ value: "", label: "Choose…" }, ...(categories.data ?? []).map((c) => ({ value: c.slug, label: c.name }))]} onChange={(v) => set({ category: v })} />
      )}
      <Count name="How many products" value={config.limit} min={2} max={24} onChange={(v) => set({ limit: v })} />
      {slider ? (
        <Choice name="Products visible at once (large screens)" value={config.perView} options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} onChange={(v) => set({ perView: v })} hint="Phones show about one and a half, tablets two. The rest slide in with the side arrows or a swipe." />
      ) : (
        <>
          <Choice name="Style" value={config.layout} options={[{ value: "grid", label: "Grid" }, { value: "carousel", label: "Scrolling row" }]} onChange={(v) => set({ layout: v })} />
          {config.layout === "grid" && (
            <Choice name="Card size" value={config.cardSize ?? "auto"} options={[{ value: "auto", label: "Fit the row (use products per row)" }, { value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }]} onChange={(v) => set({ cardSize: v })} hint="Small, medium and large keep every card the same width, however many products there are." />
          )}
          {config.layout === "grid" && (config.cardSize ?? "auto") === "auto" && <Choice name="Products per row (large screens)" value={config.columns} options={[{ value: 3, label: "3" }, { value: 4, label: "4" }, { value: 5, label: "5" }]} onChange={(v) => set({ columns: v })} />}
        </>
      )}
      <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={!!config.showViewAll} onChange={(e) => set({ showViewAll: e.target.checked })} /> Show a “View all” link</label>

      {config.source === "picks" && (
        <div className="sm:col-span-2">
          <p className={label}>Products to show, in this order</p>
          <input className={`${inputCls} mt-1.5`} placeholder="Search published products by name…" value={query} onChange={(e) => void search(e.target.value)} />
          {results.length > 0 && (
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-white text-sm">
              {results.map((r) => <li key={r.slug}><button type="button" className="flex w-full justify-between px-3 py-2 text-left hover:bg-canvas" onClick={() => { set({ picks: [...picks, r.slug] }); setResults([]); setQuery(""); }}>{r.name}<span className="text-brand-700">Add</span></button></li>)}
            </ul>
          )}
          <ul className="mt-3 space-y-1.5">
            {picks.map((slug, i) => (
              <li key={slug} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2 text-sm">
                <span>{names[slug] ?? slug}</span>
                <span className="flex gap-1">
                  <button type="button" className={btn.secondary + " !px-2 !py-0.5"} disabled={i === 0} onClick={() => { const n = [...picks]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set({ picks: n }); }} aria-label={`Move ${slug} up`}>↑</button>
                  <button type="button" className={btn.secondary + " !px-2 !py-0.5"} disabled={i === picks.length - 1} onClick={() => { const n = [...picks]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; set({ picks: n }); }} aria-label={`Move ${slug} down`}>↓</button>
                  <button type="button" className="px-2 text-red-600 hover:underline" onClick={() => set({ picks: picks.filter((p) => p !== slug) })}>Remove</button>
                </span>
              </li>
            ))}
            {picks.length === 0 && <li className="text-xs text-muted">No products chosen yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function AdsenseEditor({ config, set }: EditorProps) {
  const [code, setCode] = useState("");
  const parsed = code.trim() ? parseAdsenseCode(code) : null;
  const placement = ADSENSE_PLACEMENTS.find((p) => p.value === config.placement);

  return (
    <div className="space-y-4">
      <div>
        <label className={label}>
          Paste your AdSense ad code
          <textarea
            className={`${inputCls} mt-1.5 font-mono text-xs`}
            rows={6}
            spellCheck={false}
            placeholder={'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-…"></script>\n<ins class="adsbygoogle" … data-ad-slot="…"></ins>\n<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>'}
            value={code}
            onChange={(e) => { setCode(e.target.value); const r = parseAdsenseCode(e.target.value); if (r.ok) set(r.ad); }}
          />
          <span className={hint}>In AdSense: Ads → By ad unit → Display ads, create a unit, then copy its code. Only the ad details are kept; the pasted code is never run as it is.</span>
        </label>
        {parsed && !parsed.ok && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{parsed.error}</p>}
        {config.publisherId ? (
          <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">Connected: {adsenseSummary(config as never)}{config.layout === "in-article" ? " · in-article" : ""}</p>
        ) : (
          <p className="mt-2 text-sm text-muted">No ad connected yet, so nothing shows for this widget.</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Choice name="Where it shows" value={config.placement} options={ADSENSE_PLACEMENTS.map((p) => ({ value: p.value, label: p.label }))} onChange={(v) => set({ placement: v })} hint={placement?.help} />
        <div className="space-y-3 self-end pb-1">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={!!config.showLabel} onChange={(e) => set({ showLabel: e.target.checked })} /> Show a small “Advertisement” label</label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={!!config.testMode} onChange={(e) => set({ testMode: e.target.checked })} /><span>Test mode<span className={hint}>Shows Google test ads while you set things up. Turn it off to earn. Never click your own live ads.</span></span></label>
        </div>
      </div>

      <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-ink-3">Your <code>/ads.txt</code> file is created for you from the ads on this page. Google asks for it before it will pay you. Ads only appear on a live website that Google has approved, not on localhost.</p>
    </div>
  );
}

function TilesList({ config, set, max }: EditorProps & { max: number }) {
  return (
    <ListEditor
      items={config.items ?? []} onChange={(items) => set({ items })} max={max} noun="Tile" addLabel="+ Add a tile"
      blank={{ imageUrl: "", title: "", text: "", linkUrl: "" }}
      render={(item: Config, up) => (
        <>
          <ImageField name="Picture (required)" value={item.imageUrl ?? ""} onChange={(v) => up({ imageUrl: v })} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Text name="Title" value={item.title} onChange={(v) => up({ title: v })} max={60} />
            <Text name="Text" value={item.text} onChange={(v) => up({ text: v })} max={120} />
            <Text name="Link" value={item.linkUrl} onChange={(v) => up({ linkUrl: v })} placeholder="/products?category=toys" />
          </div>
        </>
      )}
    />
  );
}

const EDITORS: Partial<Record<WidgetType, (p: EditorProps) => ReactNode>> = {
  adsense: (p) => <AdsenseEditor {...p} />,
  products: (p) => <ProductsEditor {...p} />,
  "product-slider": (p) => <ProductsEditor {...p} slider />,
  "category-slider": ({ config, set }) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Text name="Heading" value={config.title} onChange={(v) => set({ title: v })} max={80} />
      <Text name="Small text under the heading" value={config.subtitle} onChange={(v) => set({ subtitle: v })} max={160} />
      <Choice name="Which categories" value={config.level} options={[{ value: "main", label: "Main categories" }, { value: "all", label: "Every category, subcategories too" }]} onChange={(v) => set({ level: v })} hint="Only categories that have live products are shown." />
      <Count name="Most categories to show" value={config.limit} min={1} max={24} onChange={(v) => set({ limit: v })} />
      <Choice name="Tiles visible at once (large screens)" value={config.perView} options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} onChange={(v) => set({ perView: v })} hint="Phones show about one and a half, tablets two. The rest slide in with the side arrows or a swipe." />
    </div>
  ),

  categories: ({ config, set }) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Text name="Heading" value={config.title} onChange={(v) => set({ title: v })} max={80} />
      <Text name="Small text under the heading" value={config.subtitle} onChange={(v) => set({ subtitle: v })} max={160} />
      <Choice name="Style" value={config.style} options={[{ value: "tiles", label: "Colourful tiles" }, { value: "chips", label: "Compact chips" }]} onChange={(v) => set({ style: v })} />
      <Count name="Most categories to show" value={config.limit} min={1} max={24} onChange={(v) => set({ limit: v })} />
    </div>
  ),

  "trust-bar": ({ config, set }) => (
    <ListEditor
      items={config.items ?? []} onChange={(items) => set({ items })} max={6} noun="Highlight" addLabel="+ Add a highlight"
      blank={{ icon: "star", title: "", text: "" }}
      render={(item: Config, up) => (
        <div className="grid gap-3 sm:grid-cols-[160px_1fr_1.6fr]">
          <Choice name="Icon" value={item.icon} options={TRUST_ICONS.map((i) => ({ value: i, label: TRUST_ICON_LABELS[i] }))} onChange={(v) => up({ icon: v })} />
          <Text name="Title" value={item.title} onChange={(v) => up({ title: v })} max={60} />
          <Text name="Description" value={item.text} onChange={(v) => up({ text: v })} max={140} />
        </div>
      )}
    />
  ),

  "promo-banner": ({ config, set }) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Text name="Small label above the headline" value={config.eyebrow} onChange={(v) => set({ eyebrow: v })} max={60} placeholder="LIMITED TIME" />
      <Text name="Headline" value={config.title} onChange={(v) => set({ title: v })} max={120} />
      <div className="sm:col-span-2"><Text name="Text" value={config.text} onChange={(v) => set({ text: v })} max={300} multiline /></div>
      <Text name="Button label" value={config.buttonLabel} onChange={(v) => set({ buttonLabel: v })} max={40} />
      <Text name="Link" value={config.linkUrl} onChange={(v) => set({ linkUrl: v })} placeholder="/products?type=OWN" hint="A page on this site, or an https:// address. With no button label the whole banner is clickable." />
      <Choice name="Colour" value={config.tone} options={[{ value: "brand", label: "Green" }, { value: "gold", label: "Gold" }, { value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} onChange={(v) => set({ tone: v })} />
      <Choice name="Text position" value={config.align} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }]} onChange={(v) => set({ align: v })} />
      <Choice name="Height" value={config.height} options={[{ value: "compact", label: "Compact" }, { value: "regular", label: "Regular" }, { value: "tall", label: "Tall" }]} onChange={(v) => set({ height: v })} />
      <div className="sm:col-span-2"><ImageField name="Background image (optional)" value={config.imageUrl ?? ""} onChange={(v) => set({ imageUrl: v })} /></div>
    </div>
  ),

  "image-tiles": ({ config, set }) => (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Text name="Heading" value={config.title} onChange={(v) => set({ title: v })} max={80} />
        <Text name="Small text under the heading" value={config.subtitle} onChange={(v) => set({ subtitle: v })} max={160} />
        <Choice name="Tiles per row (large screens)" value={config.columns} options={[{ value: 2, label: "2" }, { value: 3, label: "3" }, { value: 4, label: "4" }]} onChange={(v) => set({ columns: v })} />
      </div>
      <TilesList config={config} set={set} max={8} />
    </div>
  ),

  "tile-carousel": ({ config, set }) => (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Text name="Heading" value={config.title} onChange={(v) => set({ title: v })} max={80} />
        <Text name="Small text under the heading" value={config.subtitle} onChange={(v) => set({ subtitle: v })} max={160} />
        <Choice name="Tiles visible at once (large screens)" value={config.perView} options={[{ value: 2, label: "2" }, { value: 3, label: "3" }, { value: 4, label: "4" }, { value: 5, label: "5" }]} onChange={(v) => set({ perView: v })} hint="Phones show about one and a half, tablets two. The rest slide in with the side arrows or a swipe." />
        <Choice name="Tile shape" value={config.shape} options={[{ value: "landscape", label: "Wide" }, { value: "square", label: "Square" }, { value: "portrait", label: "Tall" }]} onChange={(v) => set({ shape: v })} />
      </div>
      <TilesList config={config} set={set} max={20} />
    </div>
  ),

  text: ({ config, set }) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Text name="Heading" value={config.title} onChange={(v) => set({ title: v })} max={120} />
      <div className="grid grid-cols-2 gap-4">
        <Choice name="Alignment" value={config.align} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }]} onChange={(v) => set({ align: v })} />
        <Choice name="Background" value={config.tone} options={[{ value: "plain", label: "None" }, { value: "soft", label: "Soft green" }, { value: "dark", label: "Dark" }]} onChange={(v) => set({ tone: v })} />
      </div>
      <div className="sm:col-span-2"><Text name="Text" value={config.body} onChange={(v) => set({ body: v })} max={2000} multiline hint="Plain text. Line breaks are kept." /></div>
    </div>
  ),

  faq: ({ config, set }) => (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Text name="Heading" value={config.title} onChange={(v) => set({ title: v })} max={80} />
        <Text name="Small text under the heading" value={config.subtitle} onChange={(v) => set({ subtitle: v })} max={160} />
      </div>
      <ListEditor
        items={config.items ?? []} onChange={(items) => set({ items })} max={12} noun="Question" addLabel="+ Add a question"
        blank={{ question: "", answer: "" }}
        render={(item: Config, up) => (
          <>
            <Text name="Question" value={item.question} onChange={(v) => up({ question: v })} max={200} />
            <Text name="Answer" value={item.answer} onChange={(v) => up({ answer: v })} max={1000} multiline />
          </>
        )}
      />
    </div>
  ),

  spacer: ({ config, set }) => (
    <div className="max-w-xs"><Choice name="Space" value={config.size} options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }]} onChange={(v) => set({ size: v })} /></div>
  ),
};

export function WidgetEditor({ type, config, set }: { type: WidgetType } & EditorProps) {
  const Editor = EDITORS[type];
  if (!Editor) {
    return <p className="text-sm text-muted">{type === "banners" ? "The slides come from Admin → Banners. If there are no live banners, the welcome hero is shown instead." : "This widget has nothing to set up."}</p>;
  }
  return <>{Editor({ config, set })}</>;
}
