"use client";

import { useState, type ReactNode } from "react";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { adsenseSummary, parseAdsenseCode } from "@/lib/adsense";
import { ADSENSE_PLACEMENTS, BANNER_CROP, ICON_SHAPES, ICON_SIZE_NAMES, ICON_WIDTHS, OFFER_CARD_CROP, PHONE_BANNER_CROP, PRODUCT_SOURCES, TILE_CROP, TRUST_ICONS, TRUST_ICON_LABELS, iconCrop, iconPixels, type CropSize, type IconShape, type IconSize, type WidgetType } from "@/lib/home";
import { btn, inputCls } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/ImageField";
import { Select } from "@/components/Select";

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
      <Select className={inputCls} value={value} onChange={(e) => onChange((typeof value === "number" ? Number(e.target.value) : e.target.value) as T)}>
        {options.map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
      </Select>
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

function TilesList({ config, set, max, crop }: EditorProps & { max: number; crop: CropSize }) {
  return (
    <ListEditor
      items={config.items ?? []} onChange={(items) => set({ items })} max={max} noun="Tile" addLabel="+ Add a tile"
      blank={{ imageUrl: "", title: "", text: "", linkUrl: "" }}
      render={(item: Config, up) => (
        <>
          <ImageField name="Picture (required)" value={item.imageUrl ?? ""} onChange={(v) => up({ imageUrl: v })} crop={crop} />
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

const ACCENTS = [{ value: "gold", label: "Gold" }, { value: "brand", label: "Green" }, { value: "purple", label: "Purple" }, { value: "dark", label: "Dark" }, { value: "none", label: "None" }];
const BRAND_COLOURS = [
  { value: "sky", label: "Sky blue to pink" }, { value: "sunset", label: "Sunset" }, { value: "mint", label: "Mint" }, { value: "lavender", label: "Lavender" },
  { value: "gold", label: "Cream and gold" }, { value: "brand", label: "Soft green" }, { value: "dark", label: "Dark" }, { value: "white", label: "White" },
];

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
      <TilesList config={config} set={set} max={8} crop={TILE_CROP.landscape} />
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
      <TilesList config={config} set={set} max={20} crop={TILE_CROP[config.shape as keyof typeof TILE_CROP] ?? TILE_CROP.landscape} />
    </div>
  ),

  "icon-grid": ({ config, set }) => (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Text name="Heading" value={config.title} onChange={(v) => set({ title: v })} max={80} />
        <Text name="Small text under the heading" value={config.subtitle} onChange={(v) => set({ subtitle: v })} max={160} />
        <Choice name="Icons per row (large screens)" value={config.columns} options={[3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: n, label: String(n) }))} onChange={(v) => set({ columns: v })} hint="Phones show 3 per row, tablets 4 or 5." />
        <Choice name="Shape" value={config.shape} options={(Object.keys(ICON_SHAPES) as IconShape[]).map((k) => ({ value: k, label: ICON_SHAPES[k].name + (ICON_SHAPES[k].ratio[0] === ICON_SHAPES[k].ratio[1] ? "" : ` (${ICON_SHAPES[k].ratio[0]}:${ICON_SHAPES[k].ratio[1]})`) }))} onChange={(v) => set({ shape: v })} />
        <Choice name="Icon size" value={config.size ?? "large"} options={(Object.keys(ICON_WIDTHS) as IconSize[]).map((k) => { const { w, h } = iconPixels(k, config.shape); return { value: k, label: `${ICON_SIZE_NAMES[k]} - ${w} × ${h} px (upload ${w * 2} × ${h * 2} px)` }; })} onChange={(v) => set({ size: v })} hint="Shows the size each icon appears on a large screen and the picture size to upload (twice as big keeps it sharp on phones). Crop your pictures to this ratio for a clean fit." />
        <Choice name="Picture fit" value={config.fit ?? "fill"} options={[{ value: "fill", label: "Fill the icon (edges may be cropped)" }, { value: "whole", label: "Show the whole picture (leaves a margin)" }]} onChange={(v) => set({ fit: v })} />
        <Choice name="Coloured bar at the bottom" value={config.accent} options={ACCENTS} onChange={(v) => set({ accent: v })} hint="Not shown on circles." />
        <Choice name="Icon background" value={config.background} options={[{ value: "cream", label: "Cream" }, { value: "white", label: "White" }, { value: "soft", label: "Soft green" }]} onChange={(v) => set({ background: v })} />
      </div>
      <ListEditor
        items={config.items ?? []} onChange={(items) => set({ items })} max={30} noun="Icon" addLabel="+ Add an icon"
        blank={{ imageUrl: "", title: "", linkUrl: "" }}
        render={(item: Config, up) => (
          <>
            <ImageField name="Picture (required)" value={item.imageUrl ?? ""} onChange={(v) => up({ imageUrl: v })} crop={iconCrop(config.size ?? "large", config.shape ?? "rounded")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Text name="Label under the icon" value={item.title} onChange={(v) => up({ title: v })} max={40} placeholder="Skincare" />
              <Text name="Link" value={item.linkUrl} onChange={(v) => up({ linkUrl: v })} placeholder="/products?category=skincare" />
            </div>
          </>
        )}
      />
    </div>
  ),

  "brand-cards": ({ config, set }) => (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Text name="Heading" value={config.title} onChange={(v) => set({ title: v })} max={80} />
        <Text name="Small text under the heading" value={config.subtitle} onChange={(v) => set({ subtitle: v })} max={160} />
        <Choice name="Cards per row (large screens)" value={config.columns} options={[{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }]} onChange={(v) => set({ columns: v })} />
        <Choice name="Card colour" value={config.background} options={BRAND_COLOURS} onChange={(v) => set({ background: v })} />
      </div>
      <ListEditor
        items={config.items ?? []} onChange={(items) => set({ items })} max={12} noun="Card" addLabel="+ Add a card"
        blank={{ logoUrl: "", headline: "", imageUrl: "", linkUrl: "" }}
        render={(item: Config, up) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <ImageField name="Brand logo (shown on a white tab)" value={item.logoUrl ?? ""} onChange={(v) => up({ logoUrl: v })} />
              <ImageField name="Product picture (right side)" value={item.imageUrl ?? ""} onChange={(v) => up({ imageUrl: v })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Text name="Headline" value={item.headline} onChange={(v) => up({ headline: v })} max={60} placeholder="Up to 35% Off" />
              <Text name="Link" value={item.linkUrl} onChange={(v) => up({ linkUrl: v })} placeholder="/products?category=beauty" />
            </div>
          </>
        )}
      />
    </div>
  ),

  "image-banner": ({ config, set }) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Text name="Heading above the banner (optional)" value={config.title} onChange={(v) => set({ title: v })} max={80} placeholder="Brand in spotlight" />
      <Choice name="Shape" value={config.ratio} options={[{ value: "ultra", label: "Very wide and slim" }, { value: "wide", label: "Wide" }, { value: "standard", label: "Taller" }]} onChange={(v) => set({ ratio: v })} hint="Pictures are cropped to fit, so keep the important part in the middle." />
      <div className="sm:col-span-2"><ImageField name="Banner picture (required)" value={config.imageUrl ?? ""} onChange={(v) => set({ imageUrl: v })} crop={BANNER_CROP[config.ratio as keyof typeof BANNER_CROP] ?? BANNER_CROP.wide} /></div>
      <div className="sm:col-span-2"><ImageField name="Picture for phones (optional)" value={config.mobileImageUrl ?? ""} onChange={(v) => set({ mobileImageUrl: v })} crop={PHONE_BANNER_CROP} /></div>
      <Text name="Picture description" value={config.alt} onChange={(v) => set({ alt: v })} max={120} placeholder="Fragrance for men, minimum 60% off" hint="Read aloud to people who cannot see the picture. Say what the banner says." />
      <Text name="Link" value={config.linkUrl} onChange={(v) => set({ linkUrl: v })} placeholder="/products?type=OWN" hint="A page on this site, or an https:// address." />
      <Text name="Small tag in the corner (optional)" value={config.badge} onChange={(v) => set({ badge: v })} max={12} placeholder="AD" hint="For example AD or SPONSORED." />
    </div>
  ),

  "offer-cards": ({ config, set }) => (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Text name="Heading" value={config.title} onChange={(v) => set({ title: v })} max={80} />
        <Text name="Small text under the heading" value={config.subtitle} onChange={(v) => set({ subtitle: v })} max={160} />
        <Choice name="Style" value={config.layout} options={[{ value: "slider", label: "Slider with arrows" }, { value: "grid", label: "Grid" }]} onChange={(v) => set({ layout: v })} />
        <Choice name={config.layout === "grid" ? "Cards per row (large screens)" : "Cards visible at once (large screens)"} value={config.perView} options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} onChange={(v) => set({ perView: v })} />
        <Choice name="Card shape" value={config.shape} options={[{ value: "square", label: "Square" }, { value: "portrait", label: "Tall" }, { value: "landscape", label: "Wide" }]} onChange={(v) => set({ shape: v })} />
        <Choice name="Picture fit" value={config.imageFit} options={[{ value: "cover", label: "Fill the card (may crop)" }, { value: "contain", label: "Show the whole picture" }]} onChange={(v) => set({ imageFit: v })} hint="“Show the whole picture” suits logos and product shots." />
        <Choice name="Caption position" value={config.captionStyle} options={[{ value: "below", label: "Below the card" }, { value: "overlay", label: "On the picture" }]} onChange={(v) => set({ captionStyle: v })} />
        <Choice name="Label strip colour" value={config.strip} options={ACCENTS} onChange={(v) => set({ strip: v })} hint="The strip shows each card's label, such as “Under ₹279”. With no strip the label is shown as a caption." />
        <Choice name="Card background" value={config.cardBackground} options={[{ value: "cream", label: "Cream" }, { value: "white", label: "White" }, { value: "lavender", label: "Lavender" }, { value: "none", label: "None" }]} onChange={(v) => set({ cardBackground: v })} />
        <Choice name="Coloured panel behind the cards" value={config.theme} options={[{ value: "none", label: "None" }, { value: "gold", label: "Gold" }, { value: "purple", label: "Purple" }, { value: "brand", label: "Green" }, { value: "dark", label: "Dark" }, { value: "soft", label: "Soft green" }]} onChange={(v) => set({ theme: v })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 rounded-xl border border-line p-4">
          <p className="text-sm font-semibold">Picture behind the cards (optional)</p>
          <p className="mt-0.5 text-xs text-muted">Shown across the whole panel, on top of the panel colour. Use a wide picture, such as a festive pattern.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><ImageField name="Panel picture" value={config.panelImageUrl ?? ""} onChange={(v) => set({ panelImageUrl: v })} /></div>
            <Choice name="Tint over the picture" value={config.panelOverlay ?? "none"} options={[{ value: "none", label: "None" }, { value: "dark", label: "Dark (for bright pictures)" }, { value: "light", label: "Light (for dark pictures)" }]} onChange={(v) => set({ panelOverlay: v })} hint="A tint keeps the heading and captions easy to read." />
            <Choice name="Text colour on the panel" value={config.panelText ?? "auto"} options={[{ value: "auto", label: "Automatic" }, { value: "light", label: "White" }, { value: "dark", label: "Dark" }]} onChange={(v) => set({ panelText: v })} />
          </div>
        </div>
        <ImageField name="Header picture above the cards (optional)" value={config.headerImageUrl ?? ""} onChange={(v) => set({ headerImageUrl: v })} />
        <Text name="Header picture description" value={config.headerAlt} onChange={(v) => set({ headerAlt: v })} max={120} placeholder="From Garba nights to Diwali lights" hint="Say what the picture says, for people who cannot see it." />
      </div>
      <ListEditor
        items={config.items ?? []} onChange={(items) => set({ items })} max={24} noun="Card" addLabel="+ Add a card"
        blank={{ imageUrl: "", label: "", title: "", badge: "", linkUrl: "" }}
        render={(item: Config, up) => (
          <>
            <ImageField name="Picture (required)" value={item.imageUrl ?? ""} onChange={(v) => up({ imageUrl: v })} crop={OFFER_CARD_CROP[config.shape as keyof typeof OFFER_CARD_CROP] ?? OFFER_CARD_CROP.square} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Text name="Label (strip)" value={item.label} onChange={(v) => up({ label: v })} max={40} placeholder="Under ₹279" />
              <Text name="Caption" value={item.title} onChange={(v) => up({ title: v })} max={60} placeholder="Primer" />
              <Text name="Tag (optional)" value={item.badge} onChange={(v) => up({ badge: v })} max={12} placeholder="AD" />
              <Text name="Link" value={item.linkUrl} onChange={(v) => up({ linkUrl: v })} placeholder="/products?category=beauty" />
            </div>
          </>
        )}
      />
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
