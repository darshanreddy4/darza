import { expect, test, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES, WEB } from "./data";
import { asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const SLUG = "e2e-alert-kettle";

test.describe.serial("back-in-stock alerts", () => {
  let categoryId = "";
  let productId = "";
  let shopper: BrowserContext;
  const product = (stock: number, category: string) => ({
    name: "E2E Alert Kettle", slug: SLUG, description: "Sold out until the admin restocks it.", categoryId: category, productType: "OWN",
    status: "PUBLISHED", pricePaise: 199900, sku: "E2E-KETTLE", stock, images: [{ url: "https://picsum.photos/seed/e2e/200/200" }],
  });

  test.beforeAll(async ({ playwright, browser }) => {
    const ctx = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    const cat = await (await ctx.post(`${API}/admin/categories`, { data: { name: "E2E Alerts", slug: "e2e-alerts" }, headers: asBrowser })).json();
    categoryId = cat.id;
    const created = await ctx.post(`${API}/admin/products`, { data: product(0, categoryId), headers: asBrowser });
    expect(created.ok(), await created.text()).toBeTruthy();
    productId = (await created.json()).id;
    await ctx.dispose();
    shopper = await browser.newContext({ storageState: AUTH_FILES.customer, baseURL: WEB });
  });

  test.afterAll(async ({ playwright }) => {
    await shopper.close();
    const ctx = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    await ctx.delete(`${API}/admin/products/${productId}`, { headers: asBrowser });
    await ctx.delete(`${API}/admin/categories/${categoryId}`, { headers: asBrowser });
    await ctx.dispose();
  });

  test("a guest is invited to log in, a customer can ask to be told", async ({ browser }) => {
    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL: WEB });
    const g = await guest.newPage();
    await g.goto(`/products/${SLUG}`);
    await expect(g.getByRole("button", { name: "Out of stock" })).toBeDisabled();
    await expect(g.getByRole("link", { name: "Log in" }).first()).toBeVisible();
    await guest.close();

    const page = await shopper.newPage();
    await page.goto(`/products/${SLUG}`);
    await page.getByRole("button", { name: /Notify me when it's back/ }).click();
    await expect(page.getByText(/We'll email you once this is back in stock/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/We'll email you once this is back in stock/)).toBeVisible();
    await page.close();
  });

  test("the admin sees how many people are waiting", async ({ request, page }) => {
    const rows = (await (await request.get(`${API}/admin/stock-alerts`, { headers: asBrowser })).json()) as { productId: string; waiting: number }[];
    expect(rows.find((r) => r.productId === productId)?.waiting).toBe(1);

    await page.goto("/admin/attention");
    await expect(page.getByRole("listitem").filter({ hasText: "E2E Alert Kettle" })).toContainText("1 waiting for it");
  });

  test("an alert can be cancelled and set again", async () => {
    const page = await shopper.newPage();
    await page.goto(`/products/${SLUG}`);
    await page.getByRole("button", { name: "Cancel alert" }).click();
    await expect(page.getByRole("button", { name: /Notify me when it's back/ })).toBeVisible();
    await page.getByRole("button", { name: /Notify me when it's back/ }).click();
    await expect(page.getByText(/We'll email you once this is back in stock/)).toBeVisible();
    await page.close();
  });

  test("an account without an email cannot sign up for alerts", async ({ browser }) => {
    const phoneOnly = await newCustomer(browser, "Phone Only");
    const res = await phoneOnly.request.post(`${API}/products/${SLUG}/stock-alert`, { headers: asBrowser });
    expect(res.status()).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("no email address");
    const page = await phoneOnly.newPage();
    await page.goto(`/products/${SLUG}`);
    await expect(page.getByText(/Add and verify an email address/)).toBeVisible();
    await phoneOnly.close();

    const inStock = await shopper.request.post(`${API}/products/e2e-power-bank/stock-alert`, { headers: asBrowser });
    expect(inStock.status()).toBe(400);
    expect(JSON.stringify(await inStock.json())).toContain("in stock now");
  });

  test("restocking sends the alert once and clears the waiting list", async ({ request }) => {
    const res = await request.put(`${API}/admin/products/${productId}`, { data: product(5, categoryId), headers: asBrowser });
    expect(res.ok(), await res.text()).toBeTruthy();

    await expect.poll(async () => (await (await shopper.request.get(`${API}/products/${SLUG}/stock-alert`)).json()).subscribed, { timeout: 20_000 }).toBe(false);
    const rows = (await (await request.get(`${API}/admin/stock-alerts`, { headers: asBrowser })).json()) as { productId: string }[];
    expect(rows.find((r) => r.productId === productId)).toBeUndefined();
  });
});
