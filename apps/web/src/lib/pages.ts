import { cache } from "react";
import { API_URL } from "@/lib/api";

export interface PageRow { slug: string; title: string; enabled: boolean; custom: boolean; position: number; customText: boolean }
export interface PageContent { slug: string; title: string; body: string; enabled: boolean; custom: boolean; updatedAt: string | null }

// Which pages the admin added, changed or hid. If the API is down the footer simply shows the standard pages.
export const getPageList = cache(async (): Promise<PageRow[]> => {
  const data: { pages: PageRow[] } | null = await fetch(`${API_URL}/pages`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return data?.pages ?? [];
});

// One page's saved text; null when it does not exist (or is switched off).
export const getPageContent = cache(async (slug: string): Promise<PageContent | null> => {
  const res = await fetch(`${API_URL}/pages/${encodeURIComponent(slug)}`, { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return res && res.status !== 404 ? { slug, title: "", body: "", enabled: true, custom: false, updatedAt: null } : null;
  return res.json();
});

export const BUILTIN_LINKS = [
  { slug: "terms", href: "/terms", label: "Terms & Conditions" },
  { slug: "privacy", href: "/privacy", label: "Privacy Policy" },
  { slug: "shipping-policy", href: "/shipping-policy", label: "Shipping Policy" },
  { slug: "refund-policy", href: "/refund-policy", label: "Cancellation & Refund Policy" },
  { slug: "affiliate-disclosure", href: "/affiliate-disclosure", label: "Affiliate Disclosure" },
];

// The links in the footer and on every policy page: the standard pages the admin has not hidden, the pages they added, and Contact.
export async function getLegalLinks() {
  const rows = await getPageList();
  const hidden = new Set(rows.filter((r) => !r.custom && !r.enabled).map((r) => r.slug));
  return [
    ...BUILTIN_LINKS.filter((l) => !hidden.has(l.slug)),
    ...rows.filter((r) => r.custom && r.enabled).map((r) => ({ slug: r.slug, href: `/pages/${r.slug}`, label: r.title })),
    { slug: "contact", href: "/contact", label: "Contact & Grievance" },
  ];
}
