import type { ReactNode } from "react";
import { imgSet } from "@/lib/api";
import { iconPixels, type Accent, type BrandCardsConfig, type IconGridConfig, type ImageBannerConfig, type OfferCardsConfig } from "@/lib/home";
import { Section } from "./Widgets";
import { SlideRow } from "./SlideRow";
import { SmartLink } from "./TileCard";

// Widgets modelled on busy shopping pages: icon walls, brand promo cards, a wide spotlight banner and offer cards.

const STRIP: Record<Accent, string> = {
  gold: "bg-gold text-ink",
  brand: "bg-brand-700 text-white",
  purple: "bg-linear-to-r from-violet-600 to-indigo-600 text-white",
  dark: "bg-ink text-white",
  none: "",
};
const BAR: Record<Accent, string> = { gold: "bg-gold", brand: "bg-brand-500", purple: "bg-violet-500", dark: "bg-ink", none: "" };

function Linked({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return href ? <SmartLink href={href} className={className}>{children}</SmartLink> : <div className={className}>{children}</div>;
}

// ---------- Icon grid ----------

const ICON_COLUMNS: Record<number, string> = {
  3: "grid-cols-3",
  4: "grid-cols-3 sm:grid-cols-4",
  5: "grid-cols-3 sm:grid-cols-4 md:grid-cols-5",
  6: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6",
  7: "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7",
  8: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8",
  9: "grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9",
  10: "grid-cols-3 sm:grid-cols-5 lg:grid-cols-10",
};
const ICON_BACKGROUND = { cream: "bg-gold-50", white: "bg-white shadow-card", soft: "bg-brand-50" } as const;

export function IconGridWidget({ config: c }: { config: IconGridConfig }) {
  if (c.items.length === 0) return null;
  const { w, h } = iconPixels(c.size, c.shape);
  const round = c.shape === "circle";
  const corners = round ? "rounded-full" : c.shape === "square" ? "" : "rounded-2xl";
  const fit = c.fit === "whole" ? "object-contain p-2" : "object-cover";
  return (
    <Section title={c.title} subtitle={c.subtitle}>
      <ul className={`grid gap-x-3 gap-y-5 ${ICON_COLUMNS[c.columns] ?? ICON_COLUMNS[6]}`}>
        {c.items.map((it, i) => (
          <li key={i}>
            <Linked href={it.linkUrl} className="group block text-center">
              <span style={{ maxWidth: w, aspectRatio: `${w} / ${h}` }} className={`relative mx-auto block w-full overflow-hidden ${corners} ${ICON_BACKGROUND[c.background] ?? ICON_BACKGROUND.cream}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img {...imgSet(it.imageUrl, `${w}px`, [w, w * 2, w * 3])} loading="lazy" alt="" draggable={false} className={`h-full w-full ${fit} transition duration-300 group-hover:scale-105`} />
                {!round && c.accent !== "none" && <span aria-hidden className={`absolute inset-x-0 bottom-0 h-2.5 ${BAR[c.accent]}`} />}
              </span>
              {it.title && <span className="mt-2 block text-sm font-semibold leading-tight">{it.title}</span>}
              {!it.title && <span className="sr-only">Icon {i + 1}</span>}
            </Linked>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ---------- Brand promo cards ----------

const BRAND_BACKGROUND: Record<BrandCardsConfig["background"], { box: string; text: string }> = {
  sky: { box: "bg-linear-to-br from-sky-200 via-blue-100 to-pink-200", text: "text-ink" },
  sunset: { box: "bg-linear-to-br from-amber-200 to-rose-200", text: "text-ink" },
  mint: { box: "bg-linear-to-br from-emerald-100 to-teal-200", text: "text-ink" },
  lavender: { box: "bg-linear-to-br from-violet-200 to-pink-100", text: "text-ink" },
  gold: { box: "bg-gold-50 border border-gold/40", text: "text-ink" },
  brand: { box: "bg-brand-100", text: "text-ink" },
  dark: { box: "bg-ink", text: "text-white" },
  white: { box: "bg-white border border-line shadow-card", text: "text-ink" },
};
const BRAND_COLUMNS: Record<number, string> = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3" };

export function BrandCardsWidget({ config: c }: { config: BrandCardsConfig }) {
  if (c.items.length === 0) return null;
  const look = BRAND_BACKGROUND[c.background] ?? BRAND_BACKGROUND.sky;
  return (
    <Section title={c.title} subtitle={c.subtitle}>
      <div className={`grid grid-cols-1 gap-4 ${BRAND_COLUMNS[c.columns] ?? BRAND_COLUMNS[2]}`}>
        {c.items.map((it, i) => (
          <Linked key={i} href={it.linkUrl} className={`group relative flex min-h-48 overflow-hidden rounded-2xl ${look.box} ${look.text}`}>
            {it.logoUrl && (
              <span className="absolute left-0 top-5 z-10 rounded-r-xl bg-white px-4 py-2.5 shadow-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img {...imgSet(it.logoUrl, "160px", [160, 320])} loading="lazy" alt={it.headline ? "" : "Brand logo"} draggable={false} className="h-8 w-auto max-w-32 object-contain" />
              </span>
            )}
            <span className="relative z-10 mt-auto max-w-[55%] p-5 pt-20 text-2xl font-extrabold leading-tight">{it.headline}</span>
            {it.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img {...imgSet(it.imageUrl, "(min-width: 1024px) 20vw, 45vw", [320, 640])} loading="lazy" alt="" draggable={false} className="absolute bottom-0 right-2 h-[90%] w-auto max-w-[50%] object-contain transition duration-500 group-hover:scale-105" />
            )}
          </Linked>
        ))}
      </div>
    </Section>
  );
}

// ---------- Wide image banner ----------

const BANNER_RATIO = { ultra: "aspect-[2.2/1] sm:aspect-[4.8/1]", wide: "aspect-[2/1] sm:aspect-[3/1]", standard: "aspect-[3/2] sm:aspect-[2/1]" } as const;

export function ImageBannerWidget({ config: c }: { config: ImageBannerConfig }) {
  if (!c.imageUrl) return null;
  const desktop = imgSet(c.imageUrl, "100vw", [640, 1280, 1920]);
  const phone = c.mobileImageUrl ? imgSet(c.mobileImageUrl, "100vw", [480, 800]) : null;
  const picture = (
    <span className={`group relative block overflow-hidden rounded-3xl bg-canvas shadow-card ${phone ? "aspect-[4/3] sm:aspect-[3/1]" : (BANNER_RATIO[c.ratio] ?? BANNER_RATIO.wide)} ${phone ? "" : ""}`}>
      <picture>
        {phone && <source media="(max-width: 639px)" srcSet={phone.srcSet ?? phone.src} sizes="100vw" />}
        <img {...desktop} loading="lazy" alt={c.alt} draggable={false} className="h-full w-full object-cover" />
      </picture>
      {c.badge && <span className="absolute right-3 top-3 rounded bg-black/60 px-2 py-0.5 text-[11px] font-bold tracking-widest text-white">{c.badge}</span>}
    </span>
  );
  return (
    <section aria-label={c.title || c.alt || "Banner"}>
      {c.title && <h2 className="mb-4 text-2xl font-bold">{c.title}</h2>}
      {c.linkUrl ? <SmartLink href={c.linkUrl} className="block">{picture}</SmartLink> : picture}
    </section>
  );
}

// ---------- Offer cards ----------

const PANEL: Record<OfferCardsConfig["theme"], { bg: string; dark: boolean }> = {
  none: { bg: "bg-canvas", dark: false },
  gold: { bg: "bg-linear-to-b from-gold to-gold-50", dark: false },
  purple: { bg: "bg-linear-to-br from-violet-800 to-indigo-900", dark: true },
  brand: { bg: "bg-brand-800", dark: true },
  dark: { bg: "bg-ink", dark: true },
  soft: { bg: "bg-brand-50", dark: false },
};
const CARD_BACKGROUND = { cream: "bg-gold-50", white: "bg-white", lavender: "bg-linear-to-b from-violet-100 to-amber-50", none: "bg-transparent" } as const;
const SHAPE = { square: "aspect-square", portrait: "aspect-[3/4]", landscape: "aspect-[16/10]" } as const;
const GRID_COLUMNS: Record<number, string> = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-3 lg:grid-cols-5", 6: "md:grid-cols-3 lg:grid-cols-6" };

function OfferCard({ item, c, muted }: { item: OfferCardsConfig["items"][number]; c: OfferCardsConfig; muted: string }) {
  const strip = c.strip !== "none" && !!item.label;
  const labelCaption = c.strip === "none" ? item.label : "";
  const overlayText = c.captionStyle === "overlay" ? [labelCaption, item.title].filter(Boolean).join(" · ") : "";
  const belowTitle = c.captionStyle === "below" ? item.title : "";
  const belowLabel = c.captionStyle === "below" ? labelCaption : "";
  const sizes = c.layout === "grid" ? "(min-width: 1024px) 20vw, 45vw" : `(min-width: 1024px) ${Math.round(100 / c.perView)}vw, 70vw`;
  const hasText = !!(item.title || item.label);
  return (
    <Linked href={item.linkUrl} className="group flex h-full w-full flex-col">
      <span className={`relative block overflow-hidden rounded-2xl shadow-card ${CARD_BACKGROUND[c.cardBackground] ?? CARD_BACKGROUND.cream}`}>
        <span className={`relative block ${SHAPE[c.shape] ?? SHAPE.square}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...imgSet(item.imageUrl, sizes, [320, 640, 1024])} loading="lazy" alt={hasText ? "" : "Offer"} draggable={false}
            className={`h-full w-full transition duration-500 group-hover:scale-105 ${c.imageFit === "contain" ? "object-contain p-3" : "object-cover"}`} />
          {item.badge && <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-white">{item.badge}</span>}
          {overlayText && (
            <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 to-transparent p-3 pt-12 text-white">
              <span className="block text-base font-bold leading-tight">{overlayText}</span>
            </span>
          )}
        </span>
        {strip && <span className={`block px-3 py-2 text-center text-sm font-bold ${STRIP[c.strip]}`}>{item.label}</span>}
      </span>
      {(belowLabel || belowTitle) && (
        <span className="mt-2 block text-center">
          {belowLabel && <span className="block text-base font-bold leading-snug">{belowLabel}</span>}
          {belowTitle && <span className={`block text-sm ${belowLabel ? muted : "font-medium"}`}>{belowTitle}</span>}
        </span>
      )}
    </Linked>
  );
}

export function OfferCardsWidget({ config: c }: { config: OfferCardsConfig }) {
  if (c.items.length === 0) return null;
  const panel = PANEL[c.theme] ?? PANEL.none;
  const hasPicture = !!c.panelImageUrl;
  const framed = c.theme !== "none" || hasPicture;
  // Text colour follows the panel: a dark tint or a dark colour needs light text; a chosen colour always wins.
  const light = c.panelText === "light" ? true : c.panelText === "dark" ? false : hasPicture && c.panelOverlay !== "none" ? c.panelOverlay === "dark" : panel.dark;
  const muted = light ? "text-white/85" : c.theme === "gold" || hasPicture ? "text-ink-3" : "text-muted";
  const box = framed ? `relative isolate overflow-hidden rounded-3xl p-5 sm:p-7 ${panel.bg} ${light ? "text-white" : "text-ink"}` : "";
  const cards = c.items.map((item, i) => <OfferCard key={i} item={item} c={c} muted={muted} />);
  const label = c.title || "Offers";
  return (
    <div className={box}>
      {hasPicture && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...imgSet(c.panelImageUrl, "100vw", [640, 1280, 1920])} loading="lazy" alt="" draggable={false} className="absolute inset-0 -z-10 h-full w-full object-cover" />
          {c.panelOverlay !== "none" && <span aria-hidden className={`absolute inset-0 -z-10 ${c.panelOverlay === "dark" ? "bg-black/45" : "bg-white/55"}`} />}
        </>
      )}
      {c.headerImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img {...imgSet(c.headerImageUrl, "100vw", [640, 1280, 1920])} loading="lazy" alt={c.headerAlt} draggable={false} className="mb-5 block h-auto w-full rounded-2xl" />
      )}
      {(c.title || c.subtitle) && (
        <header className="mb-5">
          {c.title && <h2 className="text-2xl font-bold">{c.title}</h2>}
          {c.subtitle && <p className={`mt-1 text-sm ${muted}`}>{c.subtitle}</p>}
        </header>
      )}
      {c.layout === "grid"
        ? <section aria-label={label}><div className={`grid grid-cols-2 gap-4 ${GRID_COLUMNS[c.perView] ?? GRID_COLUMNS[4]}`}>{cards}</div></section>
        : <SlideRow label={label} perView={c.perView}>{cards}</SlideRow>}
    </div>
  );
}
