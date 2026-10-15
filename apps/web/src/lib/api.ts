export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ProductImage { id: string; url: string; alt: string | null }
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
  showAddToCart: boolean;
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
