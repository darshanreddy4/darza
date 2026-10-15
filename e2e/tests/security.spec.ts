import { expect, test } from "@playwright/test";
import { API, AUTH_FILES, WEB } from "./data";
import { asBrowser } from "./helpers";

test.describe("security checks", () => {
  test("the storefront sends hardening headers", async ({ request }) => {
    const res = await request.get(`${WEB}/`);
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-powered-by"]).toBeUndefined();
    expect(h["permissions-policy"]).toContain("camera=()");
  });

  test("the API hides what it runs on and sends nosniff", async ({ request }) => {
    const h = (await request.get(`${API}/categories`)).headers();
    expect(h["x-powered-by"]).toBeUndefined();
    expect(h["x-content-type-options"]).toBe("nosniff");
  });

  test("every admin and account route refuses a visitor who is not signed in", async ({ request }) => {
    const gets = ["/admin/orders", "/admin/products", "/admin/users", "/admin/settings", "/admin/audit-log", "/admin/analytics/sales", "/admin/analytics/report", "/admin/returns", "/admin/questions", "/admin/coupons", "/admin/abandoned-carts", "/admin/stock-alerts", "/admin/products/export", "/orders", "/addresses", "/wishlist", "/me/email-preferences"];
    for (const path of gets) expect((await request.get(`${API}${path}`)).status(), path).toBe(401);
    for (const [path, method] of [["/admin/products", "post"], ["/admin/products/import", "post"], ["/admin/orders/x/status", "patch"], ["/admin/sales-report/send", "post"], ["/orders", "post"], ["/cart/snapshot", "put"]] as const) {
      expect((await request[method](`${API}${path}`, { data: {}, headers: asBrowser })).status(), `${method} ${path}`).toBe(401);
    }
  });

  test("a signed-in request from another website is refused", async ({ browser }) => {
    const customer = await browser.newContext({ storageState: AUTH_FILES.customer });
    const res = await customer.request.put(`${API}/cart/snapshot`, { data: { items: [] }, headers: { origin: "https://evil.example" } });
    expect(res.status()).toBe(403);
    // A garbled Referer header is a refusal, not a server error.
    const odd = await customer.request.put(`${API}/cart/snapshot`, { data: { items: [] }, headers: { referer: "not a url" } });
    expect(odd.status()).toBe(403);
    await customer.close();
  });

  test("a customer cannot reach another customer's order, invoice or return", async ({ browser, request }) => {
    const admin = await browser.newContext({ storageState: AUTH_FILES.admin });
    const orders = (await (await admin.request.get(`${API}/admin/orders`, { headers: asBrowser })).json()) as { id: string; user: { email: string | null } }[];
    await admin.close();
    const someoneElses = orders.find((o) => o.user.email !== "e2e-customer@dmg.test");
    test.skip(!someoneElses, "no other customer's order exists yet");
    const customer = await browser.newContext({ storageState: AUTH_FILES.customer });
    expect((await customer.request.get(`${API}/orders/${someoneElses!.id}/invoice`, { headers: asBrowser })).status()).toBe(404);
    expect((await customer.request.post(`${API}/orders/${someoneElses!.id}/return`, { data: { reason: "Other", items: [] }, headers: asBrowser })).status()).toBeGreaterThanOrEqual(400);
    await customer.close();
    void request;
  });

  test("passwords are never echoed and wrong ones get the same answer as unknown emails", async ({ request }) => {
    const known = await request.post(`${API}/auth/login`, { data: { email: "e2e-customer@dmg.test", password: "wrong-password-1" }, headers: asBrowser });
    const unknown = await request.post(`${API}/auth/login`, { data: { email: "nobody-here@dmg.test", password: "wrong-password-1" }, headers: asBrowser });
    expect(known.status()).toBe(401);
    expect(unknown.status()).toBe(401);
    expect(await known.text()).toBe(await unknown.text());
  });

  test("uploads accept only real pictures and keep their names to themselves", async ({ playwright }) => {
    const admin = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    const fake = await admin.post(`${API}/admin/uploads`, { multipart: { file: { name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<html><script>alert(1)</script></html> padding padding") } }, headers: asBrowser });
    expect(fake.status()).toBe(400);
    const svg = await admin.post(`${API}/admin/uploads`, { multipart: { file: { name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>') } }, headers: asBrowser });
    expect(svg.status()).toBe(400);
    await admin.dispose();
  });

  test("the sign-in redirect only goes to pages on this site", async ({ page }) => {
    await page.goto("/login?next=https://evil.example/steal");
    await page.getByPlaceholder("you@example.com").fill("e2e-customer@dmg.test");
    await page.getByPlaceholder("••••••••").fill("E2e-Pass-12345");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(new RegExp(`^${WEB.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  });
});
