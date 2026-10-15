import { expect, test, type Page } from "@playwright/test";
import { API, money, WEB } from "./data";

async function jsonLd(page: Page) {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.flatMap((b) => [JSON.parse(b)].flat());
}

test.describe("storefront", () => {
  test("home page shows categories and featured products", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/DMG/);
    await expect(page.getByRole("heading", { name: "Shop by category" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Electronics/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /E2E Power Bank/ }).first()).toBeVisible();
  });

  test("home page describes the site to search engines", async ({ page }) => {
    await page.goto("/");
    const data = await jsonLd(page);
    expect(data.map((d) => d["@type"])).toEqual(expect.arrayContaining(["Organization", "WebSite"]));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${WEB}`);
  });

  test("category filter and search narrow the product list", async ({ page }) => {
    await page.goto("/products?category=home-living");
    await expect(page.getByRole("heading", { name: "Home & Living" })).toBeVisible();
    await expect(page.getByText("E2E Sold Out Lamp").first()).toBeVisible();
    await expect(page.getByText("E2E USB-C Cable")).toHaveCount(0);

    await page.goto("/products?q=power+bank");
    await expect(page.getByText("E2E Power Bank 10000mAh").first()).toBeVisible();
    await expect(page.getByText("E2E USB-C Cable")).toHaveCount(0);
    // Search results are for shoppers, not search engines.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("a DMG product page has metadata and structured data", async ({ page }) => {
    await page.goto("/products/e2e-usb-cable");
    await expect(page.getByRole("heading", { level: 1, name: "E2E USB-C Cable" })).toBeVisible();
    await expect(page).toHaveTitle("E2E USB-C Cable by Voltix — DMG");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Braided nylon/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${WEB}/products/e2e-usb-cable`);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /E2E USB-C Cable/);

    const product = (await jsonLd(page)).find((d) => d["@type"] === "Product");
    expect(product).toMatchObject({
      name: "E2E USB-C Cable",
      brand: { name: "Voltix" },
      offers: { priceCurrency: "INR", price: "299.00", availability: "https://schema.org/InStock" },
    });
    const crumbs = (await jsonLd(page)).find((d) => d["@type"] === "BreadcrumbList");
    expect(crumbs.itemListElement.at(-1).name).toBe("E2E USB-C Cable");

    await expect(page.getByText(money(29900)).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to Cart" })).toBeEnabled();
  });

  test("a sold-out product cannot be bought and says so to search engines", async ({ page }) => {
    await page.goto("/products/e2e-sold-out-lamp");
    await expect(page.getByRole("button", { name: "Out of stock" })).toBeDisabled();
    const product = (await jsonLd(page)).find((d) => d["@type"] === "Product");
    expect(product.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  test("a partner product links out and does not claim stock", async ({ page }) => {
    await page.goto("/products/e2e-partner-speaker");
    await expect(page.getByRole("link", { name: /Buy on Amazon/ })).toHaveAttribute("href", `${API}/go/e2e-partner-speaker`);
    const product = (await jsonLd(page)).find((d) => d["@type"] === "Product");
    expect(product.offers.availability).toBeUndefined();
  });

  test("an unknown product shows not found", async ({ page }) => {
    const res = await page.goto("/products/does-not-exist");
    expect(res?.status()).toBe(404);
  });
});

test.describe("search engine files", () => {
  test("sitemap lists products and categories but not private pages", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain(`${WEB}/products/e2e-usb-cable`);
    expect(xml).toContain(`${WEB}/products?category=electronics`);
    expect(xml).toContain(`${WEB}/privacy`);
    expect(xml).not.toContain("/admin");
    expect(xml).not.toContain("/checkout");
  });

  test("robots.txt hides private areas and points to the sitemap", async ({ request }) => {
    const txt = await (await request.get("/robots.txt")).text();
    for (const path of ["/admin", "/cart", "/checkout", "/account", "/orders"]) expect(txt).toContain(`Disallow: ${path}`);
    expect(txt).toContain(`Sitemap: ${WEB}/sitemap.xml`);
  });

  for (const path of ["/cart", "/login", "/admin"]) {
    test(`${path} is marked noindex`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    });
  }
});

test.describe("legal pages", () => {
  const pages: [string, string][] = [
    ["/privacy", "Privacy Policy"],
    ["/terms", "Terms & Conditions"],
    ["/refund-policy", "Cancellation & Refund Policy"],
    ["/shipping-policy", "Shipping Policy"],
    ["/affiliate-disclosure", "Affiliate Disclosure"],
    ["/contact", "Contact & Grievance"],
  ];
  for (const [path, title] of pages) {
    test(`${title} has a heading, title and description`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page).toHaveTitle(`${title} — DMG`);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{40,}/);
    });
  }
});
