import { cache } from "react";
import { API_URL } from "@/lib/api";

export const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram", placeholder: "@yourbrand or https://instagram.com/yourbrand" },
  { key: "facebook", label: "Facebook", placeholder: "yourpage or https://facebook.com/yourpage" },
  { key: "x", label: "X (Twitter)", placeholder: "@yourbrand or https://x.com/yourbrand" },
  { key: "youtube", label: "YouTube", placeholder: "@yourchannel or https://youtube.com/@yourchannel" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/yourbrand" },
  { key: "pinterest", label: "Pinterest", placeholder: "yourbrand or https://pinterest.com/yourbrand" },
  { key: "telegram", label: "Telegram", placeholder: "@yourchannel or https://t.me/yourchannel" },
  { key: "threads", label: "Threads", placeholder: "@yourbrand or https://threads.net/@yourbrand" },
  { key: "snapchat", label: "Snapchat", placeholder: "yourbrand or https://snapchat.com/add/yourbrand" },
] as const;
export type SocialKey = (typeof SOCIAL_PLATFORMS)[number]["key"];

export interface SiteProfile {
  brandName: string;
  siteUrl: string;
  logoUrl: string;
  logoOnBadge: boolean;
  tagline: string;
  about: string;
  email: string;
  phone: string;
  address: string;
  careHours: string;
  careNote: string;
  whatsapp: string;
  whatsappMessage: string;
  whatsappButton: boolean;
  socials: Partial<Record<SocialKey, string>>;
  otherLinks: { label: string; url: string }[];
}

export const EMPTY_SITE: SiteProfile = {
  brandName: "", siteUrl: "", logoUrl: "", logoOnBadge: false, tagline: "", about: "", email: "", phone: "", address: "",
  careHours: "", careNote: "", whatsapp: "", whatsappMessage: "", whatsappButton: false, socials: {}, otherLinks: [],
};

// One request per page view, however many components ask. If the API is down the site still renders with the defaults.
export const getSite = cache(async (): Promise<SiteProfile> => {
  const data: SiteProfile | null = await fetch(`${API_URL}/site`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return data ? { ...EMPTY_SITE, ...data } : EMPTY_SITE;
});

export const whatsappUrl = (s: Pick<SiteProfile, "whatsapp" | "whatsappMessage">) =>
  s.whatsapp ? `https://wa.me/${s.whatsapp}${s.whatsappMessage ? `?text=${encodeURIComponent(s.whatsappMessage)}` : ""}` : "";

export type ContactLink = { key: string; label: string; url: string };

// Every way to reach or follow the brand, in the order they are shown.
export function contactLinks(s: SiteProfile, email?: string): ContactLink[] {
  const links: ContactLink[] = [];
  for (const p of SOCIAL_PLATFORMS) if (s.socials[p.key]) links.push({ key: p.key, label: p.label, url: s.socials[p.key]! });
  if (s.whatsapp) links.push({ key: "whatsapp", label: "WhatsApp", url: whatsappUrl(s) });
  const mail = s.email || email;
  if (mail) links.push({ key: "email", label: "Email", url: `mailto:${mail}` });
  for (const o of s.otherLinks) links.push({ key: "other", label: o.label, url: o.url });
  return links;
}

export const DEFAULT_BRAND = process.env.NEXT_PUBLIC_BUSINESS_NAME || "DMG";

// The name shown everywhere customers read it. Set under Admin → Brand & contact.
export const getBrand = cache(async () => (await getSite()).brandName || DEFAULT_BRAND);

// The website's public address: the admin's setting, else NEXT_PUBLIC_SITE_URL, else local development.
export const getSiteUrl = cache(async () => ((await getSite()).siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, ""));
