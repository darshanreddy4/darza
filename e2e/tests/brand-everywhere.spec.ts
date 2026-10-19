import { expect, test } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser, expectOptions } from "./helpers";

test.use({ storageState: AUTH_FILES.admin, viewport: { width: 1280, height: 900 } });

const NAME = "Acme Mart";
const BASE = "https://www.acme.example";

test.describe.serial("the brand name and website address follow the admin settings", () => {
  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    await ctx.put(`${API}/admin/site-profile`, { data: {}, headers: asBrowser });
    await ctx.delete(`${API}/admin/home-layout`, { headers: asBrowser });
    await ctx.dispose();
  });

  test("by default everything says DMG", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/^DMG — Discover products/);
    await expect(page.getByRole("heading", { name: "Sold by DMG", exact: true })).toBeVisible();
    await page.goto("/products/e2e-usb-cable");
    await expect(page.getByText("Sold and fulfilled by DMG").first()).toBeVisible();
  });

  test("changing the brand name and domain in the admin", async ({ page }) => {
    await page.goto("/admin/brand");
    await page.getByLabel("Brand name").fill(NAME);
    await page.getByLabel(/^Website address/).fill(`${BASE}/ignored/path`);
    await page.getByRole("button", { name: "Save changes" }).first().click();
    await expect(page.getByText("Saved. Your storefront now shows these details.")).toBeVisible();
    await expect(page.getByLabel(/^Website address/)).toHaveValue(BASE);
  });

  test("titles, header, footer and home sections use the new name", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(`${NAME} — Discover products. Choose where to buy.`);
    await expect(page.getByRole("link", { name: `${NAME} home` })).toBeVisible();
    await expect(page.getByRole("link", { name: `Sold by ${NAME}` }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: `Sold by ${NAME}`, exact: true })).toBeVisible();
    await expect(page.getByText(`Hand-picked by the ${NAME} team`)).toBeVisible();
    await expect(page.getByText(`${NAME} and partner products are labelled on every card.`)).toBeVisible();
    await expect(page.locator("footer").getByText(`© ${new Date().getFullYear()} ${NAME}`)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("DMG");
  });

  test("products say who sells them", async ({ page }) => {
    await page.goto("/products?type=OWN");
    await expect(page.getByRole("heading", { name: `Sold by ${NAME}`, exact: true })).toBeVisible();
    await expect(page.getByText(`Sold by ${NAME}`).first()).toBeVisible();
    await page.goto("/products/e2e-usb-cable");
    await expect(page).toHaveTitle(`E2E USB-C Cable by Voltix — ${NAME}`);
    await expect(page.getByText(`Sold and fulfilled by ${NAME}`).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Add to Cart" }).or(page.getByRole("button", { name: "Add to Cart" }))).toBeVisible();
  });

  test("the cart, login and policy pages use it too", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.getByText(`Products sold by ${NAME} appear here when you add them.`)).toBeVisible();
    await page.goto("/login");
    await expect(page.getByText(`Log in to your ${NAME} account.`)).toBeVisible();
    await page.goto("/terms");
    await expect(page.getByText(`${NAME} products are added to the ${NAME} cart`)).toBeVisible();
    await expect(page).toHaveTitle(`Terms & Conditions — ${NAME}`);
    await page.goto("/shipping-policy");
    await expect(page.getByText(`sold and fulfilled by ${NAME}`).first()).toBeVisible();
  });

  test("the admin area uses it", async ({ page }) => {
    await page.goto("/admin/products");
    await expect(page).toHaveTitle(`${NAME} Admin`);
    await expectOptions(page.getByLabel("Filter by type"), { present: [`Sold by ${NAME}`] });
    await expect(page.getByText(`${NAME} administration`)).toBeVisible();
    await expect(page.getByRole("complementary").getByRole("link", { name: NAME.toUpperCase() })).toBeVisible();
  });

  test("the domain is used for canonical links, structured data, the sitemap and robots.txt", async ({ page, request }) => {
    await page.goto("/products/e2e-usb-cable");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${BASE}/products/e2e-usb-cable`);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const product = blocks.flatMap((b) => [JSON.parse(b)].flat()).find((d) => d["@type"] === "Product");
    expect(product.url).toBe(`${BASE}/products/e2e-usb-cable`);

    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain(`${BASE}/products/e2e-usb-cable`);
    expect(xml).not.toContain("localhost:3100/products");
    expect(await (await request.get("/robots.txt")).text()).toContain(`Sitemap: ${BASE}/sitemap.xml`);
  });

  test("{brand} in widget and banner text is replaced as well", async ({ page, request }) => {
    const put = await request.put(`${API}/admin/home-layout`, { data: { widgets: [{ type: "text", config: { title: "Welcome to {brand}", body: "Why shop at {brand}? Because we care." } }] }, headers: asBrowser });
    expect(put.ok()).toBeTruthy();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: `Welcome to ${NAME}` })).toBeVisible();
    await expect(page.getByText(`Why shop at ${NAME}? Because we care.`)).toBeVisible();
    // The admin still sees and edits the placeholder.
    const raw = await (await request.get(`${API}/admin/home-layout`, { headers: asBrowser })).json();
    expect(raw.widgets[0].config.title).toBe("Welcome to {brand}");
  });

  test("a wrong website address is refused", async ({ request }) => {
    const res = await request.put(`${API}/admin/site-profile`, { data: { brandName: NAME, siteUrl: "http://insecure.example" }, headers: asBrowser });
    expect(res.status()).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("website address");
  });

  test("clearing the settings brings DMG back", async ({ page, request }) => {
    expect((await request.put(`${API}/admin/site-profile`, { data: {}, headers: asBrowser })).ok()).toBeTruthy();
    await request.delete(`${API}/admin/home-layout`, { headers: asBrowser });
    await page.goto("/");
    await expect(page).toHaveTitle(/^DMG — /);
    await expect(page.getByRole("heading", { name: "Sold by DMG", exact: true })).toBeVisible();
    await page.goto("/products/e2e-usb-cable");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "http://localhost:3100/products/e2e-usb-cable");
  });
});
