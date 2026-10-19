// The building blocks of the home page, and the rules for what an admin may save in each.

export const WIDGET_TYPES = ["banners", "trust-bar", "categories", "category-slider", "products", "product-slider", "promo-banner", "image-tiles", "tile-carousel", "icon-grid", "brand-cards", "image-banner", "offer-cards", "text", "faq", "how-it-works", "spacer", "adsense"] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

export interface Widget {
  id: string;
  type: WidgetType;
  active: boolean;
  config: Record<string, unknown>;
}

export const MAX_WIDGETS = 40;
export const PRODUCT_SOURCES = ["featured", "own", "affiliate", "new", "bestselling", "toprated", "category", "picks"] as const;
export const TRUST_ICONS = ["star", "shield", "coin", "truck", "refund", "headset", "lock", "gift", "heart", "clock"] as const;

export const AD_PLACEMENTS = ["inline", "left-rail", "right-rail", "bottom-bar"] as const;
export const AD_FORMATS = ["", "auto", "fluid", "rectangle", "horizontal", "vertical", "autorelaxed"] as const;
const PUBLISHER_ID = /^ca-pub-\d{10,20}$/;
const SLOT_ID = /^\d{6,20}$/;
const LAYOUT_KEY = /^[-A-Za-z0-9_+]{3,60}$/;

const SITE_PATH = /^\/(?!\/)\S*$/;
const HTTPS = /^https:\/\/\S+$/;
const IMAGE = /^(https:\/\/\S+|\/uploads\/[A-Za-z0-9._-]+)$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID = /^[A-Za-z0-9_-]{1,40}$/;

class Problems {
  list: string[] = [];
  constructor(public label: string) {}
  add(msg: string) { this.list.push(`${this.label}: ${msg}`); }
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const list = (v: unknown, max: number): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null).slice(0, max) : [];

function link(v: unknown, p: Problems, what = "Link"): string {
  const s = text(v, 2000);
  if (!s) return "";
  if (!SITE_PATH.test(s) && !HTTPS.test(s)) p.add(`${what} must be a page on this site like /products, or an https:// address`);
  return s;
}

function image(v: unknown, p: Problems, what = "Image"): string {
  const s = text(v, 2000);
  if (s && !IMAGE.test(s)) p.add(`${what} must be an uploaded image or an https:// address`);
  return s;
}

// The "which products" settings shared by the product grid and the product slider.
function collection(c: Record<string, unknown>, p: Problems) {
  const source = pick(c.source, PRODUCT_SOURCES, "featured");
  const category = text(c.category, 80);
  if (source === "category" && !SLUG.test(category)) p.add("Choose a category");
  const picks = Array.isArray(c.picks) ? [...new Set(c.picks.filter((s): s is string => typeof s === "string" && SLUG.test(s)))].slice(0, 24) : [];
  if (source === "picks" && picks.length === 0) p.add("Choose at least one product");
  return {
    title: text(c.title, 80), subtitle: text(c.subtitle, 160), source,
    category: source === "category" ? category : "",
    picks: source === "picks" ? picks : [],
    limit: int(c.limit, 2, 24, 4),
    showViewAll: bool(c.showViewAll, true),
  };
}

function tiles(v: unknown, p: Problems, max: number) {
  return list(v, max)
    .map((i) => ({ imageUrl: image(i.imageUrl, p, "Tile image"), title: text(i.title, 60), text: text(i.text, 120), linkUrl: link(i.linkUrl, p, "Tile link") }))
    .filter((i) => i.imageUrl);
}

const CLEANERS: Record<WidgetType, (c: Record<string, unknown>, p: Problems) => Record<string, unknown>> = {
  banners: () => ({}),
  "how-it-works": () => ({}),
  spacer: (c) => ({ size: pick(c.size, ["small", "medium", "large"], "medium") }),
  "trust-bar": (c) => ({
    items: list(c.items, 6)
      .map((i) => ({ icon: pick(i.icon, TRUST_ICONS, "star"), title: text(i.title, 60), text: text(i.text, 140) }))
      .filter((i) => i.title),
  }),
  categories: (c) => ({
    title: text(c.title, 80), subtitle: text(c.subtitle, 160),
    style: pick(c.style, ["tiles", "chips"], "tiles"), limit: int(c.limit, 1, 24, 8),
  }),
  products: (c, p) => ({
    ...collection(c, p),
    layout: pick(c.layout, ["grid", "carousel"], "grid"),
    columns: int(c.columns, 3, 5, 4),
    cardSize: pick(c.cardSize, ["auto", "small", "medium", "large"], "auto"),
  }),
  "product-slider": (c, p) => ({ ...collection(c, p), perView: int(c.perView, 2, 6, 4) }),
  "category-slider": (c) => ({
    title: text(c.title, 80), subtitle: text(c.subtitle, 160),
    perView: int(c.perView, 2, 6, 4), limit: int(c.limit, 1, 24, 12), level: pick(c.level, ["main", "all"], "main"),
  }),
  "promo-banner": (c, p) => {
    const out = {
      eyebrow: text(c.eyebrow, 60), title: text(c.title, 120), text: text(c.text, 300),
      buttonLabel: text(c.buttonLabel, 40), linkUrl: link(c.linkUrl, p), imageUrl: image(c.imageUrl, p),
      tone: pick(c.tone, ["brand", "gold", "dark", "light"], "brand"),
      align: pick(c.align, ["left", "center"], "left"),
      height: pick(c.height, ["compact", "regular", "tall"], "regular"),
    };
    if (!out.title && !out.imageUrl) p.add("Add a headline or an image");
    if (out.buttonLabel && !out.linkUrl) p.add("A button needs a link");
    return out;
  },
  "image-tiles": (c, p) => ({ title: text(c.title, 80), subtitle: text(c.subtitle, 160), columns: int(c.columns, 2, 4, 3), items: tiles(c.items, p, 8) }),
  "tile-carousel": (c, p) => ({
    title: text(c.title, 80), subtitle: text(c.subtitle, 160),
    perView: int(c.perView, 2, 5, 4), shape: pick(c.shape, ["landscape", "square", "portrait"], "landscape"),
    items: tiles(c.items, p, 20),
  }),
  // A wall of small picture buttons with a label under each, such as shop by category icons.
  "icon-grid": (c, p) => ({
    title: text(c.title, 80), subtitle: text(c.subtitle, 160),
    columns: int(c.columns, 3, 10, 6), size: pick(c.size, ["xsmall", "small", "medium", "large"], "large"),
    shape: pick(c.shape, ["rounded", "circle", "square", "wide", "tall"], "rounded"), fit: pick(c.fit, ["fill", "whole"], "fill"),
    accent: pick(c.accent, ["gold", "brand", "purple", "dark", "none"], "gold"),
    background: pick(c.background, ["cream", "white", "soft"], "cream"),
    items: list(c.items, 30)
      .map((i) => ({ imageUrl: image(i.imageUrl, p, "Icon image"), title: text(i.title, 40), linkUrl: link(i.linkUrl, p, "Icon link") }))
      .filter((i) => i.imageUrl),
  }),
  // Colourful promo cards: a brand logo tab, a headline and a product picture.
  "brand-cards": (c, p) => ({
    title: text(c.title, 80), subtitle: text(c.subtitle, 160),
    columns: int(c.columns, 1, 3, 2),
    background: pick(c.background, ["sky", "sunset", "mint", "lavender", "gold", "brand", "dark", "white"], "sky"),
    items: list(c.items, 12)
      .map((i) => ({ logoUrl: image(i.logoUrl, p, "Logo"), headline: text(i.headline, 60), imageUrl: image(i.imageUrl, p, "Product image"), linkUrl: link(i.linkUrl, p, "Card link") }))
      .filter((i) => i.logoUrl || i.imageUrl || i.headline),
  }),
  // One wide picture that links somewhere, with an optional "AD" style tag.
  "image-banner": (c, p) => {
    const out = {
      title: text(c.title, 80), imageUrl: image(c.imageUrl, p, "Banner image"), mobileImageUrl: image(c.mobileImageUrl, p, "Phone image"),
      alt: text(c.alt, 120), linkUrl: link(c.linkUrl, p), badge: text(c.badge, 12),
      ratio: pick(c.ratio, ["ultra", "wide", "standard"], "wide"),
    };
    if (!out.imageUrl) p.add("Add a banner image");
    return out;
  },
  // Picture cards in a slider or a grid: an optional label strip, caption, "AD" tag and a coloured panel behind them.
  "offer-cards": (c, p) => ({
    title: text(c.title, 80), subtitle: text(c.subtitle, 160),
    layout: pick(c.layout, ["slider", "grid"], "slider"), perView: int(c.perView, 2, 6, 4),
    shape: pick(c.shape, ["square", "portrait", "landscape"], "square"), imageFit: pick(c.imageFit, ["cover", "contain"], "cover"),
    captionStyle: pick(c.captionStyle, ["below", "overlay"], "below"),
    strip: pick(c.strip, ["gold", "purple", "brand", "dark", "none"], "gold"),
    cardBackground: pick(c.cardBackground, ["cream", "white", "lavender", "none"], "cream"),
    theme: pick(c.theme, ["none", "gold", "purple", "brand", "dark", "soft"], "none"),
    headerImageUrl: image(c.headerImageUrl, p, "Header image"), headerAlt: text(c.headerAlt, 120),
    // A picture behind the cards, with a tint so text stays readable and a choice of text colour.
    panelImageUrl: image(c.panelImageUrl, p, "Panel image"), panelOverlay: pick(c.panelOverlay, ["none", "light", "dark"], "none"),
    panelText: pick(c.panelText, ["auto", "light", "dark"], "auto"),
    items: list(c.items, 24)
      .map((i) => ({ imageUrl: image(i.imageUrl, p, "Card image"), label: text(i.label, 40), title: text(i.title, 60), badge: text(i.badge, 12), linkUrl: link(i.linkUrl, p, "Card link") }))
      .filter((i) => i.imageUrl),
  }),
  text: (c) => ({
    title: text(c.title, 120), body: text(c.body, 2000),
    align: pick(c.align, ["left", "center"], "left"), tone: pick(c.tone, ["plain", "soft", "dark"], "plain"),
  }),
  adsense: (c, p) => {
    const publisherId = text(c.publisherId, 40);
    const slotId = text(c.slotId, 30);
    const format = pick(c.format, AD_FORMATS, "");
    const layout = pick(c.layout, ["", "in-article"] as const, "");
    const layoutKey = text(c.layoutKey, 60);
    const width = int(c.width, 0, 2000, 0);
    const height = int(c.height, 0, 2000, 0);
    const configured = Boolean(publisherId || slotId);
    if (configured) {
      if (!PUBLISHER_ID.test(publisherId)) p.add("The publisher ID looks wrong. It starts with ca-pub- followed by digits");
      if (!SLOT_ID.test(slotId)) p.add("The ad slot ID looks wrong. It is a number from your ad unit code");
      if (layoutKey && !LAYOUT_KEY.test(layoutKey)) p.add("The layout key looks wrong");
      if (!format && !(width && height)) p.add("The ad needs a format or a fixed width and height");
    }
    return {
      publisherId: configured ? publisherId : "", slotId: configured ? slotId : "", format, layout, layoutKey, width, height,
      responsive: bool(c.responsive, true),
      placement: pick(c.placement, AD_PLACEMENTS, "inline"),
      showLabel: bool(c.showLabel, true),
      testMode: bool(c.testMode, false),
    };
  },
  faq: (c) => ({
    title: text(c.title, 80), subtitle: text(c.subtitle, 160),
    items: list(c.items, 12).map((i) => ({ question: text(i.question, 200), answer: text(i.answer, 1000) })).filter((i) => i.question && i.answer),
  }),
};

export function sanitizeLayout(input: unknown): { widgets: Widget[] } | { errors: string[] } {
  if (!Array.isArray(input)) return { errors: ["The layout must be a list of widgets"] };
  if (input.length > MAX_WIDGETS) return { errors: [`A page can have at most ${MAX_WIDGETS} widgets`] };

  const errors: string[] = [];
  const seen = new Set<string>();
  const widgets: Widget[] = [];
  input.forEach((raw, index) => {
    const w = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const type = w.type as WidgetType;
    if (!WIDGET_TYPES.includes(type)) return void errors.push(`Widget ${index + 1}: unknown type`);

    const p = new Problems(`Widget ${index + 1} (${type})`);
    const config = CLEANERS[type]((typeof w.config === "object" && w.config !== null ? w.config : {}) as Record<string, unknown>, p);
    errors.push(...p.list);

    let id = typeof w.id === "string" && ID.test(w.id) ? w.id : "";
    if (!id || seen.has(id)) id = `w${Date.now().toString(36)}${index}${Math.random().toString(36).slice(2, 6)}`;
    seen.add(id);
    widgets.push({ id, type, active: bool(w.active, true), config });
  });
  return errors.length ? { errors } : { widgets };
}

// What the home page looked like before it became editable.
export const DEFAULT_LAYOUT: Widget[] = [
  { id: "default-banners", type: "banners", active: true, config: {} },
  {
    id: "default-trust", type: "trust-bar", active: true,
    config: {
      items: [
        { icon: "star", title: "Hand-picked catalogue", text: "Every product is reviewed before it is published." },
        { icon: "shield", title: "Always know the seller", text: "{brand} and partner products are labelled on every card." },
        { icon: "coin", title: "No extra cost via partners", text: "Partner links never change the price you pay." },
      ],
    },
  },
  { id: "default-categories", type: "categories", active: true, config: { title: "Shop by category", subtitle: "Only categories with live products", style: "tiles", limit: 24 } },
  { id: "default-featured", type: "products", active: true, config: { title: "Featured", subtitle: "Hand-picked by the {brand} team", source: "featured", category: "", picks: [], limit: 4, layout: "grid", columns: 4, cardSize: "auto", showViewAll: true } },
  { id: "default-own", type: "products", active: true, config: { title: "Sold by {brand}", subtitle: "Add to cart and check out directly with us", source: "own", category: "", picks: [], limit: 4, layout: "grid", columns: 4, cardSize: "auto", showViewAll: true } },
  { id: "default-partner", type: "products", active: true, config: { title: "Partner picks", subtitle: "Discover here, buy on the partner marketplace", source: "affiliate", category: "", picks: [], limit: 4, layout: "grid", columns: 4, cardSize: "auto", showViewAll: true } },
  { id: "default-how", type: "how-it-works", active: true, config: {} },
];
