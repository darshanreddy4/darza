import { expect, type APIRequestContext, type Browser } from "@playwright/test";
import { API, WEB } from "./data";

// Requests made with a saved admin session. The origin header is what a browser would send.
export const asBrowser = { origin: WEB };

export async function adminProduct(request: APIRequestContext, slug: string) {
  const list = await request.get(`${API}/admin/products?q=${slug}`, { headers: asBrowser });
  expect(list.ok()).toBeTruthy();
  const rows = (await list.json()) as { id: string; slug: string; stock: number | null; pricePaise: number }[];
  const found = rows.find((p) => p.slug === slug);
  expect(found, `product ${slug}`).toBeTruthy();
  return found!;
}

export async function findUser(request: APIRequestContext, email: string) {
  const res = await request.get(`${API}/admin/users?q=${encodeURIComponent(email)}`, { headers: asBrowser });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { items: { id: string; email: string; role: "ADMIN" | "CUSTOMER" }[] };
  const user = body.items.find((u) => u.email === email);
  expect(user, `user ${email}`).toBeTruthy();
  return user!;
}

// A new browser session for a customer who signed up with a mobile number. Those accounts count as verified, so they can order and post straight away.
export async function newCustomer(browser: Browser, name = "Phone Customer") {
  const context = await browser.newContext({ baseURL: WEB });
  const phone = `96${String(Date.now()).slice(-8)}${Math.floor(Math.random() * 10)}`.slice(0, 10);
  const sent = await context.request.post(`${API}/auth/otp/send`, { data: { phone, purpose: "signup" }, headers: asBrowser });
  const { devCode } = (await sent.json()) as { devCode: string };
  const done = await context.request.post(`${API}/auth/otp/verify`, { data: { phone, purpose: "signup", code: devCode, name, termsAccepted: true }, headers: asBrowser });
  expect(done.ok()).toBeTruthy();
  return Object.assign(context, { phone });
}

// Direct access to the throwaway test database, for things no screen exposes, such as the secret inside an emailed link.
export async function withDb<T>(fn: (db: { $executeRawUnsafe(sql: string, ...values: unknown[]): Promise<number> }) => Promise<T>): Promise<T> {
  const { createRequire } = await import("node:module");
  const { resolve } = await import("node:path");
  const { PrismaClient } = createRequire(resolve(process.cwd(), "../apps/api/package.json"))("@prisma/client");
  const db = new PrismaClient({ datasourceUrl: process.env.E2E_DATABASE_URL });
  try { return await fn(db); } finally { await db.$disconnect(); }
}

// Replaces the hidden token of the newest unused link of a kind with one the test knows, so the test can open "the link from the email".
export async function knownLinkToken(type: "EMAIL_ADD" | "EMAIL_VERIFY" | "PASSWORD_RESET", data?: string) {
  const { createHash } = await import("node:crypto");
  const raw = `e2e-link-${Date.now()}-${Math.random().toString(36).slice(2)}-padding`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const changed = await withDb((db) => data
    ? db.$executeRawUnsafe(`UPDATE "AuthToken" SET "tokenHash" = $1 WHERE type = '${type}'::"AuthTokenType" AND "usedAt" IS NULL AND data = $2`, hash, data)
    : db.$executeRawUnsafe(`UPDATE "AuthToken" SET "tokenHash" = $1 WHERE type = '${type}'::"AuthTokenType" AND "usedAt" IS NULL`, hash));
  expect(changed, "an unused link was issued").toBeGreaterThan(0);
  return raw;
}
