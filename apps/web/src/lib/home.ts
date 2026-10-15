// Shared by the home page and the admin page builder. The API checks and cleans everything again on save.

export type WidgetType = "banners" | "trust-bar" | "categories" | "products" | "product-slider" | "category-slider" | "promo-banner" | "image-tiles" | "tile-carousel" | "text" | "faq" | "how-it-works" | "spacer" | "adsense";

export interface HomeWidget<C = Record<string, unknown>> {
  id: string;
  type: WidgetType;
  active: boolean;
  config: C;
}

export const TRUST_ICONS = ["star", "shield", "coin", "truck", "refund", "headset", "lock", "gift", "heart", "clock"] as const;
export const TRUST_ICON_LABELS: Record<(typeof TRUST_ICONS)[number], string> = {
  star: "Star", shield: "Shield", coin: "Coin", truck: "Delivery truck", refund: "Refund", headset: "Support", lock: "Lock", gift: "Gift", heart: "Heart", clock: "Clock",
};

export const PRODUCT_SOURCES = [
  { value: "featured", label: "Featured products" },
  { value: "own", label: "Our own products" },
  { value: "affiliate", label: "Partner picks" },
  { value: "new", label: "New arrivals" },
  { value: "bestselling", label: "Best sellers" },
  { value: "toprated", label: "Top rated" },
  { value: "category", label: "One category" },
  { value: "picks", label: "Products I choose" },
] as const;
export type ProductSource = (typeof PRODUCT_SOURCES)[number]["value"];

export interface ProductsConfig { title: string; subtitle: string; source: ProductSource; category: string; picks: string[]; limit: number; layout: "grid" | "carousel"; columns: 3 | 4 | 5; cardSize: "auto" | "small" | "medium" | "large"; showViewAll: boolean }
export interface ProductSliderConfig { title: string; subtitle: string; source: ProductSource; category: string; picks: string[]; limit: number; perView: 2 | 3 | 4 | 5 | 6; showViewAll: boolean }
export interface CategorySliderConfig { title: string; subtitle: string; perView: 2 | 3 | 4 | 5 | 6; limit: number; level: "main" | "all" }
export interface CategoriesConfig { title: string; subtitle: string; style: "tiles" | "chips"; limit: number }
export interface TrustConfig { items: { icon: (typeof TRUST_ICONS)[number]; title: string; text: string }[] }
export interface PromoConfig { eyebrow: string; title: string; text: string; buttonLabel: string; linkUrl: string; imageUrl: string; tone: "brand" | "gold" | "dark" | "light"; align: "left" | "center"; height: "compact" | "regular" | "tall" }
export interface TilesConfig { title: string; subtitle: string; columns: 2 | 3 | 4; items: { imageUrl: string; title: string; text: string; linkUrl: string }[] }
export interface TileCarouselConfig { title: string; subtitle: string; perView: 2 | 3 | 4 | 5 | 6; shape: "landscape" | "square" | "portrait"; items: { imageUrl: string; title: string; text: string; linkUrl: string }[] }
export interface TextConfig { title: string; body: string; align: "left" | "center"; tone: "plain" | "soft" | "dark" }
export interface FaqConfig { title: string; subtitle: string; items: { question: string; answer: string }[] }
export interface SpacerConfig { size: "small" | "medium" | "large" }

export const ADSENSE_PLACEMENTS = [
  { value: "inline", label: "In the page", help: "Shown right here, between the widgets above and below. Good for banners and in-article ads." },
  { value: "left-rail", label: "Left side", help: "A tall ad fixed to the left edge. Only on very wide screens, so it never covers the content. Use a vertical or 160×600 unit." },
  { value: "right-rail", label: "Right side", help: "The same, on the right edge." },
  { value: "bottom-bar", label: "Sticky bottom bar", help: "A slim ad pinned to the bottom of the screen that visitors can close. Use a 320×50 or 728×90 unit." },
] as const;
export type AdsensePlacement = (typeof ADSENSE_PLACEMENTS)[number]["value"];

export interface AdsenseConfig {
  publisherId: string; slotId: string; format: string; layout: string; layoutKey: string; responsive: boolean;
  width: number; height: number; placement: AdsensePlacement; showLabel: boolean; testMode: boolean;
}

export const WIDGET_CATALOG: { type: WidgetType; label: string; description: string; defaults: Record<string, unknown> }[] = [
  { type: "banners", label: "Banner slider", description: "The big banners you manage under Banners. Shows the welcome hero when there are none.", defaults: {} },
  { type: "products", label: "Product collection", description: "A row or grid of products: featured, new arrivals, best sellers, a category, or products you pick.", defaults: { title: "New arrivals", subtitle: "", source: "new", category: "", picks: [], limit: 4, layout: "grid", columns: 4, cardSize: "auto", showViewAll: true } },
  { type: "categories", label: "Shop by category", description: "Your categories as colourful tiles or a compact row of chips.", defaults: { title: "Shop by category", subtitle: "", style: "tiles", limit: 8 } },
  { type: "product-slider", label: "Product slider", description: "Products in one row with side arrows: show 3 or 4 at a time and let visitors slide to see more. Same choices as a product collection.", defaults: { title: "Best sellers", subtitle: "", source: "bestselling", category: "", picks: [], limit: 12, perView: 4, showViewAll: true } },
  { type: "category-slider", label: "Category slider", description: "Your categories as colourful tiles in one row with side arrows. Show main categories or every subcategory too.", defaults: { title: "Shop by category", subtitle: "", perView: 4, limit: 12, level: "main" } },
  { type: "promo-banner", label: "Promo strip", description: "One wide banner with a headline, text, a button and an optional background image.", defaults: { eyebrow: "", title: "Festival sale", text: "", buttonLabel: "Shop now", linkUrl: "/products", imageUrl: "", tone: "brand", align: "left", height: "regular" } },
  { type: "image-tiles", label: "Image tiles", description: "Two to four picture cards that link anywhere, such as shop by occasion or by brand.", defaults: { title: "", subtitle: "", columns: 3, items: [] } },
  { type: "tile-carousel", label: "Image tile slider", description: "Like image tiles, but in one row with side arrows: show 3 or 4 at a time and let visitors slide to see the rest. Up to 20 tiles.", defaults: { title: "", subtitle: "", perView: 4, shape: "landscape", items: [] } },
  { type: "trust-bar", label: "Highlights bar", description: "Up to six short promises with icons, like free delivery or easy returns.", defaults: { items: [{ icon: "truck", title: "Free delivery", text: "On orders above the free-delivery amount." }] } },
  { type: "text", label: "Text block", description: "A heading and a paragraph, such as a welcome note or an announcement.", defaults: { title: "Welcome", body: "", align: "left", tone: "plain" } },
  { type: "faq", label: "Questions and answers", description: "Common questions as an expandable list. Also helps search engines.", defaults: { title: "Frequently asked questions", subtitle: "", items: [{ question: "How long does delivery take?", answer: "" }] } },
  { type: "how-it-works", label: "How shopping works", description: "The two-way explainer: buying from us vs buying from a partner.", defaults: {} },
  { type: "adsense", label: "Google AdSense ad", description: "Earn from ads: paste the code from your AdSense ad unit and choose where it shows, in the page, on the sides or as a sticky bar.", defaults: { publisherId: "", slotId: "", format: "auto", layout: "", layoutKey: "", responsive: true, width: 0, height: 0, placement: "inline", showLabel: true, testMode: false } },
  { type: "spacer", label: "Spacer", description: "Empty space between two widgets.", defaults: { size: "medium" } },
];

export const widgetLabel = (type: WidgetType) => WIDGET_CATALOG.find((w) => w.type === type)?.label ?? type;

export function newWidgetId() {
  return `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
