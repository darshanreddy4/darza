import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { API, AUTH_FILES, WEB } from "./data";
import { asBrowser } from "./helpers";

test.use({ storageState: AUTH_FILES.admin, viewport: { width: 1280, height: 900 } });

const signedOut = { cookies: [], origins: [] };
const put = (request: APIRequestContext, path: string, data: object) => request.put(`${API}${path}`, { data, headers: asBrowser });
const post = (request: APIRequestContext, path: string, data: object) => request.post(`${API}${path}`, { data, headers: asBrowser });
const del = (request: APIRequestContext, path: string) => request.delete(`${API}${path}`, { headers: asBrowser });

async function shopper(browser: import("@playwright/test").Browser) {
  const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
  return { ctx, page: await ctx.newPage() };
}

test.describe.serial("pages and policies", () => {
  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    for (const slug of ["terms", "privacy", "size-guide", "api-page"]) await del(ctx, `/admin/pages/${slug}`);
    await put(ctx, "/admin/site-profile", {});
    await ctx.dispose();
  });

  test("before anything is changed, the standard pages are there and linked from the footer", async ({ browser }) => {
    const { ctx, page } = await shopper(browser);
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms & Conditions", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "1. Who we are" })).toBeVisible();
    await expect(page.getByText("DMG is operated by")).toBeVisible();
    const footer = page.locator("footer");
    for (const name of ["Terms & Conditions", "Privacy Policy", "Shipping Policy", "Cancellation & Refund Policy", "Affiliate Disclosure", "Contact & Grievance"]) {
      await expect(footer.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(footer.getByText("Transparency")).toBeVisible();
    await expect(page.getByText("Partner links are always clearly marked")).toBeVisible();
    await ctx.close();
  });

  test("only an admin can change pages, and what is saved is checked", async ({ request, browser, playwright }) => {
    const customer = await playwright.request.newContext({ storageState: AUTH_FILES.customer });
    expect((await customer.get(`${API}/admin/pages`)).status()).toBe(403);
    expect((await post(customer, "/admin/pages", { title: "X", body: "Y" })).status()).toBe(403);
    expect((await put(customer, "/admin/pages/terms", { body: "Y" })).status()).toBe(403);
    expect((await del(customer, "/admin/pages/terms")).status()).toBe(403);
    await customer.dispose();

    expect((await post(request, "/admin/pages", { title: "", body: "text" })).status()).toBe(400);
    expect((await post(request, "/admin/pages", { title: "No text", body: "" })).status()).toBe(400);
    expect((await post(request, "/admin/pages", { title: "Terms", slug: "terms", body: "x" })).status()).toBe(400);
    expect((await post(request, "/admin/pages", { title: "Admin", slug: "admin", body: "x" })).status()).toBe(400);
    expect((await post(request, "/admin/pages", { title: "Bad", slug: "Not Allowed!", body: "x" })).status()).toBe(400);
    expect((await post(request, "/admin/pages", { title: "Long", slug: "long", body: "x".repeat(60001) })).status()).toBe(400);
    expect((await put(request, "/admin/pages/not-a-page", { title: "x", body: "y" })).status()).toBe(404);

    const { ctx, page } = await shopper(browser);
    expect((await page.request.get(`${API}/pages/not-a-page`)).status()).toBe(404);
    const standard = (await (await page.request.get(`${API}/pages/terms`)).json()) as { body: string; enabled: boolean };
    expect(standard).toMatchObject({ body: "", enabled: true });
    await ctx.close();
  });

  test("the admin adds a page of their own from the admin portal", async ({ page, browser }) => {
    await page.goto("/admin/pages");
    await expect(page.getByRole("heading", { name: "Pages & policies" })).toBeVisible();
    await page.getByRole("button", { name: "+ Add a page" }).click();
    await page.getByLabel("Page title").fill("Size guide");
    await expect(page.getByLabel("Page address")).toHaveValue("size-guide");
    await page.getByLabel("Page text").fill("Welcome to {brand}.\n\n## Measuring\nUse a **soft tape**. See the [Contact](/contact) page.\n\n- Chest\n- Waist\n\n1. First\n2. Second");
    await expect(page.getByRole("heading", { name: "Measuring" })).toBeVisible();
    await page.getByRole("button", { name: "Add page" }).click();
    await expect(page.getByText("Saved. The page is updated on your website.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Size guide" })).toBeVisible();

    const { ctx, page: shop } = await shopper(browser);
    await shop.goto("/pages/size-guide");
    await expect(shop.getByRole("heading", { name: "Size guide", level: 1 })).toBeVisible();
    await expect(shop.getByRole("heading", { name: "Measuring" })).toBeVisible();
    await expect(shop.getByText("Welcome to DMG.")).toBeVisible();
    await expect(shop.locator("strong", { hasText: "soft tape" })).toBeVisible();
    await expect(shop.getByRole("link", { name: "Contact", exact: true })).toHaveAttribute("href", "/contact");
    await expect(shop.getByRole("listitem").filter({ hasText: "Chest" })).toBeVisible();
    await expect(shop.locator("ol li")).toHaveCount(2);
    await expect(shop.locator("footer").getByRole("link", { name: "Size guide" })).toHaveAttribute("href", "/pages/size-guide");
    await expect(shop).toHaveTitle(/Size guide/);
    const sitemap = await (await shop.request.get(`${WEB}/sitemap.xml`)).text();
    expect(sitemap).toContain("/pages/size-guide");
    await ctx.close();
  });

  test("pasted code is shown as plain text and unsafe links are not links", async ({ request, browser }) => {
    expect((await post(request, "/admin/pages", { title: "API page", slug: "api-page", body: "<script>window.__pwned = 1</script>\n\n[bad](javascript:alert(1)) and [ok](https://example.com)\n\n<img src=x onerror=\"window.__pwned = 2\">" })).ok()).toBeTruthy();
    const { ctx, page } = await shopper(browser);
    await page.goto("/pages/api-page");
    await expect(page.getByText("<script>window.__pwned = 1</script>")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    await expect(page.locator('a[href^="javascript"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "ok", exact: true })).toHaveAttribute("rel", /noopener/);
    await expect(page.getByText("bad", { exact: false }).first()).toBeVisible();
    await ctx.close();
  });

  test("the admin rewrites a standard policy, and can go back to the standard text", async ({ page, browser }) => {
    await page.goto("/admin/pages");
    await page.getByRole("button", { name: "Edit Terms & Conditions" }).click();
    await page.getByRole("radio", { name: /Write my own text/ }).click();
    await expect(page.getByLabel("Page text")).toHaveValue(/Who we are/);
    await page.getByLabel("Page text").fill("## Our own terms\nShopping with {brand} means you agree to be nice.");
    await page.getByRole("button", { name: "Save page" }).click();
    await expect(page.getByText("Saved. The page is updated on your website.")).toBeVisible();

    const { ctx, page: shop } = await shopper(browser);
    await shop.goto("/terms");
    await expect(shop.getByRole("heading", { name: "Our own terms" })).toBeVisible();
    await expect(shop.getByText("Shopping with DMG means you agree to be nice.")).toBeVisible();
    await expect(shop.getByRole("heading", { name: "1. Who we are" })).toHaveCount(0);
    await expect(shop.getByText(/Last updated/)).not.toContainText("13 October 2026");

    await page.getByRole("button", { name: "Edit Terms & Conditions" }).click();
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Reset to standard" }).click();
    await expect(page.getByText("This page is back to its standard text.")).toBeVisible();
    await shop.reload();
    await expect(shop.getByRole("heading", { name: "1. Who we are" })).toBeVisible();
    await ctx.close();
  });

  test("a page can be hidden: it leaves the footer and the sitemap and cannot be opened", async ({ request, browser }) => {
    expect((await put(request, "/admin/pages/privacy", { enabled: false })).ok()).toBeTruthy();
    const { ctx, page } = await shopper(browser);
    const res = await page.goto("/privacy");
    expect(res?.status()).toBe(404);
    await page.goto("/terms");
    await expect(page.locator("footer").getByRole("link", { name: "Privacy Policy" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Policies" }).getByRole("link", { name: "Privacy Policy" })).toHaveCount(0);
    expect(await (await page.request.get(`${WEB}/sitemap.xml`)).text()).not.toContain("/privacy");
    expect((await del(request, "/admin/pages/privacy")).ok()).toBeTruthy();
    await page.reload();
    await expect(page.locator("footer").getByRole("link", { name: "Privacy Policy" })).toBeVisible();
    expect((await page.goto("/privacy"))?.status()).toBe(200);
    await ctx.close();
  });

  test("a deleted page stops working", async ({ page, browser }) => {
    await page.goto("/admin/pages");
    await page.getByRole("button", { name: "Edit Size guide" }).click();
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Delete page" }).click();
    await expect(page.getByText("The page was deleted.")).toBeVisible();
    const { ctx, page: shop } = await shopper(browser);
    expect((await shop.goto("/pages/size-guide"))?.status()).toBe(404);
    await expect(shop.locator("footer").getByRole("link", { name: "Size guide" })).toHaveCount(0);
    await ctx.close();
  });

  test("the message bar and the footer note are set from the admin portal", async ({ page, browser }) => {
    await page.goto("/admin/pages");
    await page.getByLabel(/^Message/).fill("Free delivery on orders above ₹499 this week");
    await page.getByLabel("Footer note").fill("**Heads up:** every link to a partner is marked. See [our policy](/privacy).");
    await page.getByRole("button", { name: "Save message bar and footer note" }).click();
    await expect(page.getByText("Saved. The message bar and footer are updated.")).toBeVisible();

    const { ctx, page: shop } = await shopper(browser);
    await shop.goto("/");
    await expect(shop.getByText("Free delivery on orders above ₹499 this week")).toBeVisible();
    await expect(shop.getByText("Partner links are always clearly marked")).toHaveCount(0);
    await expect(shop.locator("footer").getByText("Heads up:")).toBeVisible();
    await expect(shop.locator("footer").getByRole("link", { name: "our policy" })).toHaveAttribute("href", "/privacy");

    await page.getByLabel("Show the message bar above the header").uncheck();
    await page.getByLabel("Show the Transparency box in the footer").uncheck();
    await page.getByRole("button", { name: "Save message bar and footer note" }).click();
    await expect(page.getByText("Saved. The message bar and footer are updated.")).toBeVisible();
    await shop.reload();
    await expect(shop.getByText("Free delivery on orders above ₹499 this week")).toHaveCount(0);
    await expect(shop.locator("footer").getByText("Transparency")).toHaveCount(0);
    await ctx.close();
  });

  test("legal and grievance details are set in the brand page and shown on the contact page", async ({ page, request, browser }) => {
    expect((await put(request, "/admin/site-profile", { gstin: "12345" })).status()).toBe(400);
    await page.goto("/admin/brand");
    await page.getByLabel("Registered business name").fill("Acme Retail Pvt Ltd");
    await page.getByLabel(/^GSTIN/).fill("29abcde1234f1z5");
    await page.getByLabel("Grievance officer").fill("Asha Rao");
    await page.getByLabel("Grievance email").fill("grievance@acme.test");
    await page.getByRole("button", { name: "Save changes" }).first().click();
    await expect(page.getByText("Saved. Your storefront now shows these details.")).toBeVisible();

    const { ctx, page: shop } = await shopper(browser);
    await shop.goto("/contact");
    await expect(shop.getByText("Acme Retail Pvt Ltd")).toBeVisible();
    await expect(shop.getByText("29ABCDE1234F1Z5")).toBeVisible();
    await expect(shop.getByText("Asha Rao")).toBeVisible();
    await expect(shop.getByRole("link", { name: "grievance@acme.test" })).toBeVisible();
    await shop.goto("/terms");
    await expect(shop.getByText(/operated by Acme Retail Pvt Ltd/)).toBeVisible();
    await ctx.close();
  });

  test("the editor and the custom page have no accessibility problems", async ({ page, request, browser }) => {
    expect((await post(request, "/admin/pages", { title: "Size guide", slug: "size-guide", body: "## Fit\nText\n\n- One" })).ok()).toBeTruthy();
    await page.goto("/admin/pages");
    await page.getByRole("button", { name: "Edit Size guide" }).click();
    await expect(page.getByLabel("Page text")).toBeVisible();
    const admin = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(admin.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 100)}`)).toEqual([]);

    const { ctx, page: shop } = await shopper(browser);
    await shop.goto("/pages/size-guide");
    const store = await new AxeBuilder({ page: shop }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(store.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 100)}`)).toEqual([]);
    await ctx.close();
  });
});
