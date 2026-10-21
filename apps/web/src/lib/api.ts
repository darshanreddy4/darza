export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ProductImage { id: string; url: string; alt: string | null }
export interface ProductVariant { slug: string; colorName: string | null; packSize: string | null; image: string | null; inStock: boolean | null }
// One version of a product (Black / L, 20W, 5000 mAh) with its own price; pricePaise on the product is the lowest of these.
export interface ProductOption { id: string; label: string; values: string[]; imageUrl: string | null; pricePaise: number; mrpPaise: number | null; inStock: boolean }
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  brand: string | null;
  specifications: Record<string, string>;
  productType: "OWN" | "AFFILIATE";
  featured: boolean;
  pricePaise: number;
  mrpPaise: number | null;
  sellerName: string;
  deliveryInfo: string | null;
  returnPolicy: string | null;
  platform: string | null;
  affiliateDisclosure: string | null;
  inStock: boolean | null;
  ratingAvg: number | null;
  ratingCount: number;
  images: ProductImage[];
  videoUrls: string[];
  highlights: string[];
  // Per-product storefront card options set by the admin.
  showRating: boolean;
  dealLabel: string | null;
  // Calendar date (YYYY-MM-DD) the product is expected to arrive; null when not shown.
  deliveryBy: string | null;
  freeDelivery: boolean;
  // Heavy or bulky: always pays delivery (the store's fee when this is null).
  chargeDelivery: boolean;
  deliveryFeePaise: number | null;
  showAddToCart: boolean;
  // e.g. "1750 ml"; "Only few left" and the units-bought count come from real stock and orders.
  packSize: string | null;
  saleTag: "TOP_DISCOUNT" | "LOWEST_PRICE" | null;
  lowStock: boolean;
  soldCount: number;
  multiBuy: { qty: number; percent: number } | null;
  // A running timed sale: pricePaise is already the sale price; the normal price comes back after endsAt.
  sale: { endsAt: string } | null;
  // Days after delivery it can be returned; 0 means it cannot be returned.
  returnDays: number;
  // Must be paid for online in full (no pay on delivery); and the share paid online first when the product is sold with part payment, the rest on delivery.
  onlineOnly?: boolean;
  advancePercent?: number | null;
  colorName: string | null;
  warranty: string | null;
  manufacturerInfo: string | null;
  // Other products in the same variant group (only on the product page); empty when there are none.
  variants?: ProductVariant[];
  // What the shopper chooses between, named by the admin ("Colour", "Size"), and the versions to choose from.
  optionNames?: string[];
  options?: ProductOption[];
  category?: { name: string; slug: string; parent?: { name: string; slug: string } | null };
}
export interface Category { id: string; name: string; slug: string; parentId: string | null; productCount: number }
export interface ProductList { total: number; page: number; limit: number; items: Product[] }

export async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

export const formatPrice = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

// Uploaded images are stored as "/uploads/…" paths served by the API; remote images are absolute URLs.
export const imgSrc = (url: string) => (url.startsWith("/") ? `${API_URL}${url}` : url);

// Pictures uploaded in the admin come in several sizes from the API, so a phone downloads kilobytes instead of the original.
// Remote (https) images and animated or vector files are used as they are.
const SIZED = /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/;
export const imgSized = (url: string, width: number) => (SIZED.test(url) ? `${API_URL}/img/${url.slice("/uploads/".length)}?w=${width}` : imgSrc(url));

// src, srcSet and sizes for an <img>. `sizes` says how wide the picture is shown, so the browser picks the smallest copy that is sharp enough.
export function imgSet(url: string, sizes: string, widths: number[] = [320, 640, 1024]) {
  if (!SIZED.test(url)) return { src: imgSrc(url) };
  return { src: imgSized(url, widths[Math.min(1, widths.length - 1)]), srcSet: widths.map((w) => `${imgSized(url, w)} ${w}w`).join(", "), sizes };
}

// "2026-10-15" -> "Thu, 15 Oct". The date is a plain calendar day, so it is formatted in UTC to avoid shifting it.
export const formatDeliveryDate = (isoDate: string) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));
