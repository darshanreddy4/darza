// Policy and information pages the admin can rewrite, hide or add to. The standard wording lives in the web app; the
// API only keeps what the admin changed.

export const BUILTIN_PAGES = ["terms", "privacy", "shipping-policy", "refund-policy", "affiliate-disclosure"] as const;
export type BuiltinPage = (typeof BUILTIN_PAGES)[number];

// Addresses the storefront already uses, which a custom page may not take.
const RESERVED = new Set<string>([
  ...BUILTIN_PAGES, "about", "contact", "products", "cart", "checkout", "account", "orders", "wishlist", "compare", "login", "signup",
  "forgot-password", "reset-password", "verify-email", "unsubscribe", "admin", "api", "pages", "uploads", "sitemap", "robots",
]);

export const MAX_PAGE_BODY = 60_000;
export const MAX_PAGE_TITLE = 80;
export const MAX_CUSTOM_PAGES = 30;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const isBuiltin = (slug: string): slug is BuiltinPage => (BUILTIN_PAGES as readonly string[]).includes(slug);

export function slugify(title: string) {
  return title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
}

export function slugProblem(slug: string): string | null {
  if (!slug) return "Give the page an address, for example size-guide";
  if (slug.length > 60 || !SLUG.test(slug)) return "The address can only have lowercase letters, numbers and single dashes, for example size-guide";
  if (RESERVED.has(slug)) return `"${slug}" is already used by the website; choose another address`;
  return null;
}

export interface PageInput { title: string; body: string; enabled: boolean }

const clean = (v: unknown, max: number) =>
  // eslint-disable-next-line no-control-regex
  typeof v === "string" ? v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max) : "";

// A built-in page may have an empty body (use the standard text); a custom page needs a title and some text.
export function sanitizePage(input: unknown, custom: boolean): { page: PageInput } | { errors: string[] } {
  const c = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const title = clean(c.title, MAX_PAGE_TITLE).replace(/\s+/g, " ");
  const rawBody = typeof c.body === "string" ? c.body : "";
  if (rawBody.length > MAX_PAGE_BODY) errors.push(`The page is longer than ${MAX_PAGE_BODY.toLocaleString("en-IN")} characters`);
  const body = clean(c.body, MAX_PAGE_BODY);
  if (custom) {
    if (!title) errors.push("Give the page a title");
    if (!body) errors.push("Write some text for the page");
  }
  if (errors.length) return { errors };
  return { page: { title, body, enabled: c.enabled !== false } };
}
