// Shared by the home page and the admin page builder. The API checks and cleans everything again on save.

export type WidgetType = "banners" | "trust-bar" | "categories" | "products" | "product-slider" | "category-slider" | "promo-banner" | "image-tiles" | "tile-carousel" | "icon-grid" | "brand-cards" | "image-banner" | "offer-cards" | "text" | "faq" | "how-it-works" | "spacer" | "adsense";

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
export type Accent = "gold" | "brand" | "purple" | "dark" | "none";
export type IconSize = "xsmall" | "small" | "medium" | "large";
export type IconShape = "rounded" | "circle" | "square" | "wide" | "tall";
export interface IconGridConfig { title: string; subtitle: string; columns: number; size: IconSize; shape: IconShape; fit: "fill" | "whole"; accent: Accent; background: "cream" | "white" | "soft"; items: { imageUrl: string; title: string; linkUrl: string }[] }
// Icon width in pixels per size, and width : height per shape. Shared by the storefront and the admin size menu.
export const ICON_WIDTHS: Record<IconSize, number> = { xsmall: 72, small: 96, medium: 132, large: 180 };
export const ICON_SIZE_NAMES: Record<IconSize, string> = { xsmall: "Extra small", small: "Small", medium: "Medium", large: "Large" };
export const ICON_SHAPES: Record<IconShape, { name: string; ratio: [number, number] }> = {
  rounded: { name: "Rounded square", ratio: [1, 1] },
  circle: { name: "Circle", ratio: [1, 1] },
  square: { name: "Square (sharp corners)", ratio: [1, 1] },
  wide: { name: "Wide rectangle", ratio: [4, 3] },
  tall: { name: "Tall rectangle", ratio: [3, 4] },
};
export function iconPixels(size: IconSize, shape: IconShape) {
  const w = ICON_WIDTHS[size] ?? ICON_WIDTHS.large;
  const [rw, rh] = (ICON_SHAPES[shape] ?? ICON_SHAPES.rounded).ratio;
  return { w, h: Math.round((w * rh) / rw) };
}

// Pixel sizes pictures are cut to when "crop automatically" is on: twice the size shown, so they stay sharp on phones.
export interface CropSize { w: number; h: number }
export const iconCrop = (size: IconSize, shape: IconShape): CropSize => { const { w, h } = iconPixels(size, shape); return { w: w * 2, h: h * 2 }; };
export const TILE_CROP: Record<"landscape" | "square" | "portrait", CropSize> = { landscape: { w: 1200, h: 900 }, square: { w: 1000, h: 1000 }, portrait: { w: 900, h: 1200 } };
export const OFFER_CARD_CROP: Record<"landscape" | "square" | "portrait", CropSize> = { landscape: { w: 1000, h: 625 }, square: { w: 800, h: 800 }, portrait: { w: 750, h: 1000 } };
export const BANNER_CROP: Record<"ultra" | "wide" | "standard", CropSize> = { ultra: { w: 2400, h: 500 }, wide: { w: 2400, h: 800 }, standard: { w: 2400, h: 1200 } };
export const PHONE_BANNER_CROP: CropSize = { w: 1200, h: 900 };

export type CardBackground = "sky" | "sunset" | "mint" | "lavender" | "gold" | "brand" | "dark" | "white";
export interface BrandCardsConfig { title: string; subtitle: string; columns: 1 | 2 | 3; background: CardBackground; items: { logoUrl: string; headline: string; imageUrl: string; linkUrl: string }[] }
export interface ImageBannerConfig { title: string; imageUrl: string; mobileImageUrl: string; alt: string; linkUrl: string; badge: string; ratio: "ultra" | "wide" | "standard" }
export interface OfferCardsConfig {
  title: string; subtitle: string; layout: "slider" | "grid"; perView: 2 | 3 | 4 | 5 | 6; shape: "square" | "portrait" | "landscape"; imageFit: "cover" | "contain";
  captionStyle: "below" | "overlay"; strip: Accent; cardBackground: "cream" | "white" | "lavender" | "none"; theme: "none" | "gold" | "purple" | "brand" | "dark" | "soft";
  headerImageUrl: string; headerAlt: string; panelImageUrl: string; panelOverlay: "none" | "light" | "dark"; panelText: "auto" | "light" | "dark";
  items: { imageUrl: string; label: string; title: string; badge: string; linkUrl: string }[];
}
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
  { type: "icon-grid", label: "Icon grid", description: "A wall of small picture buttons with a label under each, like shop by category icons. Up to 30, in rows of 3 to 10.", defaults: { title: "", subtitle: "", columns: 6, size: "large", shape: "rounded", fit: "fill", accent: "gold", background: "cream", items: [] } },
  { type: "brand-cards", label: "Brand promo cards", description: "Colourful cards with a brand logo, a headline such as “Up to 35% Off” and a product picture. Two or three per row.", defaults: { title: "Big brands", subtitle: "", columns: 2, background: "sky", items: [] } },
  { type: "image-banner", label: "Wide image banner", description: "One wide picture that links anywhere, with an optional “AD” tag. Good for a brand in the spotlight. Can use a different picture on phones.", defaults: { title: "", imageUrl: "", mobileImageUrl: "", alt: "", linkUrl: "", badge: "", ratio: "wide" } },
  { type: "offer-cards", label: "Offer cards", description: "Picture cards in a slider or grid with an optional price or discount strip, caption, “AD” tag, a coloured panel behind them and a header picture. For daily deals, partners and festive stories.", defaults: { title: "New deals every day", subtitle: "", layout: "slider", perView: 4, shape: "square", imageFit: "cover", captionStyle: "below", strip: "gold", cardBackground: "cream", theme: "none", headerImageUrl: "", headerAlt: "", panelImageUrl: "", panelOverlay: "none", panelText: "auto", items: [] } },
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
