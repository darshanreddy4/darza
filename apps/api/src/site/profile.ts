// What an admin may save as the store's brand, contact and social details, and how it is cleaned.

export const SOCIAL_PLATFORMS = ["instagram", "facebook", "x", "youtube", "linkedin", "pinterest", "telegram", "threads", "snapchat"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

// A bare @handle becomes a full link for these.
const HANDLE_BASE: Partial<Record<SocialPlatform, string>> = {
  instagram: "https://instagram.com/",
  facebook: "https://facebook.com/",
  x: "https://x.com/",
  youtube: "https://youtube.com/@",
  pinterest: "https://pinterest.com/",
  telegram: "https://t.me/",
  threads: "https://threads.net/@",
  snapchat: "https://snapchat.com/add/",
};

export interface OtherLink { label: string; url: string }

export interface SiteProfileData {
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
  socials: Partial<Record<SocialPlatform, string>>;
  otherLinks: OtherLink[];
}

export const EMPTY_PROFILE: SiteProfileData = {
  brandName: "", siteUrl: "", logoUrl: "", logoOnBadge: false, tagline: "", about: "", email: "", phone: "", address: "",
  careHours: "", careNote: "", whatsapp: "", whatsappMessage: "", whatsappButton: false, socials: {}, otherLinks: [],
};

const IMAGE = /^(https:\/\/\S+|\/uploads\/[A-Za-z0-9._-]+)$/;
const HTTPS = /^https:\/\/[^\s/$.?#][^\s]*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ()-]{6,20}$/;
const HANDLE = /^@?[A-Za-z0-9._-]{1,60}$/;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Phone numbers for wa.me links: digits only, with the country code.
export const whatsappDigits = (v: string) => v.replace(/\D/g, "");

export function sanitizeProfile(input: unknown): { profile: SiteProfileData } | { errors: string[] } {
  const c = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const errors: string[] = [];

  const logoUrl = text(c.logoUrl, 2000);
  if (logoUrl && !IMAGE.test(logoUrl)) errors.push("The logo must be an uploaded image or an https:// address");

  // The website's address: https (or plain http for local testing), reduced to scheme and host.
  let siteUrl = "";
  const rawUrl = text(c.siteUrl, 200);
  if (rawUrl) {
    try {
      const u = new URL(/^[a-z]+:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
      const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
      if (u.protocol !== "https:" && !(local && u.protocol === "http:")) throw new Error("scheme");
      siteUrl = u.origin;
    } catch {
      errors.push("The website address should look like https://www.yourbrand.com");
    }
  }

  const email = text(c.email, 120);
  if (email && !EMAIL.test(email)) errors.push("The email address does not look right");

  const phone = text(c.phone, 30);
  if (phone && !PHONE.test(phone)) errors.push("The phone number should only have digits, spaces, + ( ) and -");

  const whatsappRaw = text(c.whatsapp, 30);
  const whatsapp = whatsappDigits(whatsappRaw);
  if (whatsappRaw && (whatsapp.length < 8 || whatsapp.length > 15)) errors.push("The WhatsApp number needs the country code, for example 91 98765 43210");

  const socials: SiteProfileData["socials"] = {};
  const rawSocials = (typeof c.socials === "object" && c.socials !== null ? c.socials : {}) as Record<string, unknown>;
  for (const platform of SOCIAL_PLATFORMS) {
    const v = text(rawSocials[platform], 300);
    if (!v) continue;
    const base = HANDLE_BASE[platform];
    if (HTTPS.test(v)) socials[platform] = v;
    else if (base && HANDLE.test(v)) socials[platform] = base + v.replace(/^@/, "");
    else errors.push(`The ${platform} link should be a full https:// address${base ? " or a handle like @yourbrand" : ""}`);
  }

  const otherLinks: OtherLink[] = [];
  for (const raw of Array.isArray(c.otherLinks) ? c.otherLinks.slice(0, 6) : []) {
    const l = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const label = text(l.label, 40);
    const url = text(l.url, 500);
    if (!label && !url) continue;
    if (!label || !HTTPS.test(url)) errors.push(`Other links need a name and a full https:// address${label ? ` (check “${label}”)` : ""}`);
    else otherLinks.push({ label, url });
  }

  if (errors.length) return { errors };
  return {
    profile: {
      brandName: text(c.brandName, 40), siteUrl, logoUrl, logoOnBadge: c.logoOnBadge === true,
      tagline: text(c.tagline, 200), about: text(c.about, 4000),
      email, phone, address: text(c.address, 300),
      careHours: text(c.careHours, 120), careNote: text(c.careNote, 300),
      whatsapp, whatsappMessage: text(c.whatsappMessage, 200), whatsappButton: c.whatsappButton === true && whatsapp !== "",
      socials, otherLinks,
    },
  };
}
