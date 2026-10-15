import { imgSrc, type Product } from "@/lib/api";

// Canonical links, the sitemap and social previews need the full address; `base` comes from getSiteUrl().
export const absoluteUrl = (base: string, path: string) => `${base}${path.startsWith("/") ? path : `/${path}`}`;

// One tidy line for meta descriptions: collapsed whitespace, cut at a word boundary.
export function describe(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30)).trimEnd()}…`;
}

// JSON placed inside a <script> tag: "<" is escaped so product text can never close the tag early.
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

export function productJsonLd(p: Product, base: string) {
  const url = absoluteUrl(base, `/products/${p.slug}`);
  const own = p.productType === "OWN";
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: describe(p.description, 500),
    url,
    image: p.images.map((i) => (i.url.startsWith("/") ? imgSrc(i.url) : i.url)),
    ...(p.brand && { brand: { "@type": "Brand", name: p.brand } }),
    ...(p.category && { category: p.category.name }),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "INR",
      price: (p.pricePaise / 100).toFixed(2),
      // Stock is only known for our own products.
      ...(own && { availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" }),
      seller: { "@type": "Organization", name: p.sellerName },
    },
    ...(p.ratingCount > 0 && p.ratingAvg !== null && {
      aggregateRating: { "@type": "AggregateRating", ratingValue: p.ratingAvg, reviewCount: p.ratingCount },
    }),
  };
}

export function breadcrumbJsonLd(trail: { name: string; path: string }[], base: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: absoluteUrl(base, t.path) })),
  };
}
