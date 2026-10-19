import type { MetadataRoute } from "next";
import { API_URL } from "@/lib/api";
import { absoluteUrl } from "@/lib/seo";
import { getLegalLinks } from "@/lib/pages";
import { getSiteUrl } from "@/lib/site-profile";

// Built on request (the API may not exist at build time); the API caches the list, so this stays cheap.
export const dynamic = "force-dynamic";

const STATIC_PAGES = ["/about"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data: { products: { slug: string; updatedAt: string }[]; categories: { slug: string }[] } | null = await fetch(`${API_URL}/sitemap`, { next: { revalidate: 600 } })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  const [base, legalLinks] = await Promise.all([getSiteUrl(), getLegalLinks()]);
  const abs = (path: string) => absoluteUrl(base, path);

  return [
    { url: abs("/"), changeFrequency: "daily", priority: 1 },
    { url: abs("/products"), changeFrequency: "daily", priority: 0.9 },
    ...(data?.categories ?? []).map((c) => ({ url: abs(`/products?category=${encodeURIComponent(c.slug)}`), changeFrequency: "daily" as const, priority: 0.8 })),
    ...(data?.products ?? []).map((p) => ({ url: abs(`/products/${encodeURIComponent(p.slug)}`), lastModified: new Date(p.updatedAt), changeFrequency: "weekly" as const, priority: 0.7 })),
    ...[...STATIC_PAGES, ...legalLinks.map((l) => l.href)].map((path) => ({ url: abs(path), changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
