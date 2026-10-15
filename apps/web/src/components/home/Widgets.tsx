import Link from "next/link";
import type { ReactNode } from "react";
import { imgSet, type Category, type Product } from "@/lib/api";
import { buildCategoryTree } from "@/lib/categories";
import type { CategoriesConfig, CategorySliderConfig, FaqConfig, ProductSliderConfig, ProductsConfig, TileCarouselConfig, PromoConfig, SpacerConfig, TextConfig, TilesConfig, TrustConfig } from "@/lib/home";
import { ProductCard } from "@/components/ProductCard";
import { ProductCarousel } from "@/components/ProductCarousel";
import { JsonLd } from "@/components/JsonLd";
import { SmartLink, TileCard } from "./TileCard";
import { SlideRow } from "./SlideRow";

const TILE_STYLES = [
  "from-brand-600 to-brand-800", "from-indigo-600 to-violet-800", "from-amber-500 to-orange-700",
  "from-sky-600 to-blue-800", "from-rose-500 to-pink-800", "from-slate-600 to-slate-900",
];

const ICONS: Record<string, string> = {
  star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z",
  shield: "M9 12l2 2 4-4M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z",
  coin: "M12 8v8M9.5 10.5c0-1 1-1.8 2.5-1.8s2.5.8 2.5 1.8-1 1.6-2.5 1.9-2.5.9-2.5 1.9 1 1.8 2.5 1.8 2.5-.8 2.5-1.8M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  truck: "M1 6h13v10H1zM14 10h4l4 3v3h-8M5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  refund: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  headset: "M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H4zM17 14h3v5h-3zM20 19a3 3 0 0 1-3 3h-3",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  gift: "M4 10h16v10H4zM2 7h20v3H2zM12 7v13M12 7C10 3 6 4 7 6s5 1 5 1zM12 7c2-4 6-3 5-1s-5 1-5 1z",
  heart: "M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
};

// A chosen card size keeps every card the same width however many products there are; "auto" divides the row by "per row".
const CARD_SIZE: Partial<Record<string, string>> = {
  small: "sm:grid-cols-[repeat(auto-fill,11.25rem)]",
  medium: "sm:grid-cols-[repeat(auto-fill,15rem)]",
  large: "sm:grid-cols-[repeat(auto-fill,19rem)]",
};
const COLUMNS: Record<number, string> = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" };

export function Section({ title, subtitle, href, children }: { title?: string; subtitle?: string; href?: string; children: ReactNode }) {
  return (
    <section>
      {(title || subtitle || href) && (
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            {title && <h2 className="text-2xl font-bold">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          {href && <Link href={href} className="shrink-0 text-sm font-semibold text-brand-700 hover:underline">View all →</Link>}
        </div>
      )}
      {children}
    </section>
  );
}

const VIEW_ALL: Partial<Record<string, string>> = { featured: "/products?featured=true", own: "/products?type=OWN", affiliate: "/products?type=AFFILIATE", new: "/products" };

export function ProductsWidget({ config, products }: { config: ProductsConfig; products: Product[] }) {
  if (products.length === 0) return null;
  const href = config.showViewAll ? (config.source === "category" ? `/products?category=${encodeURIComponent(config.category)}` : VIEW_ALL[config.source]) : undefined;
  if (config.layout === "carousel") return <ProductCarousel title={config.title || "Products"} subtitle={config.subtitle} href={href} items={products} />;
  return (
    <Section title={config.title} subtitle={config.subtitle} href={href}>
      <div className={`grid grid-cols-2 gap-4 ${CARD_SIZE[config.cardSize] ?? COLUMNS[config.columns] ?? COLUMNS[4]}`}>
        {products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </Section>
  );
}

function CategoryTile({ c, index }: { c: Category & { children?: { name: string }[] }; index: number }) {
  const subs = c.children ?? [];
  return (
    <Link
      href={`/products?category=${c.slug}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl bg-linear-to-br ${TILE_STYLES[index % TILE_STYLES.length]} p-6 text-white shadow-card transition hover:-translate-y-1 hover:shadow-lift`}
    >
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 transition group-hover:scale-125" />
      <h3 className="relative text-xl font-bold">{c.name}</h3>
      <p className="relative mt-1 text-sm text-white/80">{c.productCount} {c.productCount === 1 ? "product" : "products"}</p>
      {subs.length > 0 && (
        <p className="relative mt-3 line-clamp-2 text-xs text-white/70">{subs.slice(0, 4).map((x) => x.name).join(" · ")}{subs.length > 4 ? ` +${subs.length - 4} more` : ""}</p>
      )}
      <span className="relative mt-auto inline-block pt-6 text-sm font-semibold">Explore →</span>
    </Link>
  );
}

export function CategoriesWidget({ config, categories }: { config: CategoriesConfig; categories: Category[] }) {
  const topLevel = buildCategoryTree(categories).slice(0, config.limit);
  if (topLevel.length === 0) return null;
  if (config.style === "chips") {
    return (
      <Section title={config.title} subtitle={config.subtitle}>
        <div className="flex flex-wrap gap-2">
          {topLevel.map((c) => (
            <Link key={c.id} href={`/products?category=${c.slug}`} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium shadow-card transition hover:border-brand-500 hover:text-brand-700">
              {c.name} <span className="text-muted">({c.productCount})</span>
            </Link>
          ))}
        </div>
      </Section>
    );
  }
  return (
    <Section title={config.title} subtitle={config.subtitle}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {topLevel.map((c, i) => (
          <CategoryTile key={c.id} c={c} index={i} />
        ))}
      </div>
    </Section>
  );
}

export function TrustWidget({ config }: { config: TrustConfig }) {
  if (config.items.length === 0) return null;
  const cols = ["", "", "md:grid-cols-2", "md:grid-cols-3", "md:grid-cols-4"][config.items.length] ?? "md:grid-cols-3";
  return (
    <section className={`grid gap-4 rounded-2xl border border-line bg-white p-6 shadow-card ${cols}`}>
      {config.items.map((i, n) => (
        <div key={`${i.title}-${n}`} className="flex gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[i.icon] ?? ICONS.star} /></svg>
          </span>
          <div>
            <h3 className="font-semibold">{i.title}</h3>
            {i.text && <p className="mt-0.5 text-sm text-muted">{i.text}</p>}
          </div>
        </div>
      ))}
    </section>
  );
}

const PROMO_TONE = {
  brand: { box: "bg-linear-to-br from-brand-600 to-brand-800 text-white", button: "bg-white text-ink hover:bg-white/90", overlay: true },
  gold: { box: "bg-linear-to-br from-gold to-amber-500 text-ink", button: "bg-ink text-white hover:bg-ink-3", overlay: false },
  dark: { box: "bg-ink text-white", button: "bg-brand-500 text-ink hover:bg-brand-600", overlay: true },
  light: { box: "border border-line bg-white text-ink", button: "bg-ink text-white hover:bg-ink-3", overlay: false },
} as const;
const PROMO_HEIGHT = { compact: "min-h-[140px]", regular: "min-h-[220px]", tall: "min-h-[340px]" } as const;

export function PromoWidget({ config }: { config: PromoConfig }) {
  const tone = PROMO_TONE[config.tone] ?? PROMO_TONE.brand;
  const center = config.align === "center";
  const wholeLink = config.linkUrl && !config.buttonLabel;
  const body = (
    <div className={`relative overflow-hidden rounded-3xl shadow-card ${tone.box} ${PROMO_HEIGHT[config.height] ?? PROMO_HEIGHT.regular}`}>
      {config.imageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...imgSet(config.imageUrl, "100vw", [640, 1280, 1600])} loading="lazy" alt="" className="absolute inset-0 h-full w-full object-cover" />
          {tone.overlay && <div className="absolute inset-0 bg-ink/45" />}
        </>
      )}
      <div className={`relative flex h-full min-h-[inherit] flex-col justify-center gap-2 p-8 sm:p-12 ${center ? "items-center text-center" : "items-start"}`}>
        {config.eyebrow && <p className="text-xs font-semibold uppercase tracking-widest opacity-80">{config.eyebrow}</p>}
        {config.title && <h2 className="max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl">{config.title}</h2>}
        {config.text && <p className="max-w-xl text-base opacity-85">{config.text}</p>}
        {config.buttonLabel && config.linkUrl && (
          <SmartLink href={config.linkUrl} className={`mt-3 inline-block rounded-xl px-6 py-3 text-sm font-semibold transition ${tone.button}`}>{config.buttonLabel}</SmartLink>
        )}
      </div>
    </div>
  );
  return wholeLink ? <SmartLink href={config.linkUrl} className="block">{body}</SmartLink> : <section>{body}</section>;
}

export function TilesWidget({ config }: { config: TilesConfig }) {
  if (config.items.length === 0) return null;
  return (
    <Section title={config.title} subtitle={config.subtitle}>
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${COLUMNS[config.columns] ?? COLUMNS[3]}`}>
        {config.items.map((t, i) => <TileCard key={i} tile={t} />)}
      </div>
    </Section>
  );
}

export function ProductSliderWidget({ config, products }: { config: ProductSliderConfig; products: Product[] }) {
  if (products.length === 0) return null;
  const href = config.showViewAll ? (config.source === "category" ? `/products?category=${encodeURIComponent(config.category)}` : VIEW_ALL[config.source]) : undefined;
  return (
    <SlideRow title={config.title} subtitle={config.subtitle} href={href} label={config.title || "Products"} perView={config.perView}>
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </SlideRow>
  );
}

export function CategorySliderWidget({ config, categories }: { config: CategorySliderConfig; categories: Category[] }) {
  const list = (config.level === "all" ? [...categories].sort((a, b) => a.name.localeCompare(b.name)) : buildCategoryTree(categories)).slice(0, config.limit);
  if (list.length === 0) return null;
  return (
    <SlideRow title={config.title} subtitle={config.subtitle} label={config.title || "Categories"} perView={config.perView}>
      {list.map((c, i) => <CategoryTile key={c.id} c={c} index={i} />)}
    </SlideRow>
  );
}

export function TileCarouselWidget({ config }: { config: TileCarouselConfig }) {
  if (config.items.length === 0) return null;
  return (
    <SlideRow title={config.title} subtitle={config.subtitle} label={config.title || "Highlights"} perView={config.perView}>
      {config.items.map((t, i) => <TileCard key={i} tile={t} shape={config.shape} />)}
    </SlideRow>
  );
}

export function TextWidget({ config }: { config: TextConfig }) {
  if (!config.title && !config.body) return null;
  const tone = { plain: "", soft: "rounded-3xl bg-brand-50 p-8 sm:p-12", dark: "rounded-3xl bg-ink p-8 text-white sm:p-12" }[config.tone] ?? "";
  return (
    <section className={`${tone} ${config.align === "center" ? "text-center" : ""}`}>
      {config.title && <h2 className="text-3xl font-bold">{config.title}</h2>}
      {config.body && <p className={`mt-3 max-w-3xl whitespace-pre-line leading-relaxed ${config.tone === "dark" ? "text-white/80" : "text-ink-3"} ${config.align === "center" ? "mx-auto" : ""}`}>{config.body}</p>}
    </section>
  );
}

export function FaqWidget({ config }: { config: FaqConfig }) {
  if (config.items.length === 0) return null;
  return (
    <Section title={config.title} subtitle={config.subtitle}>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: config.items.map((i) => ({ "@type": "Question", name: i.question, acceptedAnswer: { "@type": "Answer", text: i.answer } })) }} />
      <div className="divide-y divide-line rounded-2xl border border-line bg-white shadow-card">
        {config.items.map((i, n) => (
          <details key={n} className="group px-6 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {i.question}
              <span aria-hidden className="text-xl text-muted transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-3">{i.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function SpacerWidget({ config }: { config: SpacerConfig }) {
  const h = { small: "h-2", medium: "h-8", large: "h-20" }[config.size] ?? "h-8";
  return <div aria-hidden className={h} />;
}
