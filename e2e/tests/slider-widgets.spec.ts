import { pick } from "./helpers";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser } from "./helpers";

test.use({ storageState: AUTH_FILES.admin, viewport: { width: 1280, height: 900 } });

const put = (request: APIRequestContext, widget: Record<string, unknown>) =>
  request.put(`${API}/admin/home-layout`, { data: { widgets: [widget] }, headers: asBrowser });

test.describe.serial("product and category sliders", () => {
  const made: { categories: string[]; products: string[] } = { categories: [], products: [] };

  test.beforeAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    for (const name of ["Alpha", "Beta"]) {
      const cat = await (await ctx.post(`${API}/admin/categories`, { data: { name: `E2E ${name}`, slug: `e2e-${name.toLowerCase()}` }, headers: asBrowser })).json();
      made.categories.push(cat.id);
      const prod = await ctx.post(`${API}/admin/products`, {
        data: {
          name: `E2E ${name} Item`, slug: `e2e-${name.toLowerCase()}-item`, description: "Slider test product.", categoryId: cat.id, productType: "OWN",
          status: "PUBLISHED", pricePaise: 10000, sku: `E2E-${name}`, stock: 3, images: [{ url: "https://picsum.photos/seed/e2e/200/200" }],
        },
        headers: asBrowser,
      });
      expect(prod.ok(), await prod.text()).toBeTruthy();
      made.products.push((await prod.json()).id);
    }
    await ctx.dispose();
  });

  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    await ctx.delete(`${API}/admin/home-layout`, { headers: asBrowser });
    for (const id of made.products) await ctx.delete(`${API}/admin/products/${id}`, { headers: asBrowser });
    for (const id of made.categories) await ctx.delete(`${API}/admin/categories/${id}`, { headers: asBrowser });
    await ctx.dispose();
  });

  test("a product slider shows a few products and slides to the rest", async ({ page, request }) => {
    // Newest first: Beta item, Alpha item, then the older seeded ones.
    expect((await put(request, { type: "product-slider", config: { title: "Fresh", source: "new", limit: 6, perView: 3 } })).ok()).toBeTruthy();
    await page.goto("/");

    const card = (slug: string) => page.locator(`a[href="/products/${slug}"]`).first();
    await expect(card("e2e-beta-item")).toBeInViewport();
    await expect(card("e2e-alpha-item")).toBeInViewport();
    await expect(page.getByRole("button", { name: "Previous Fresh" })).toBeDisabled();
    await expect(page.getByRole("link", { name: "View all →" })).toHaveAttribute("href", "/products");

    // Six products at three a time: the last one is off screen until the arrow is used.
    const last = page.locator("section[aria-label='Fresh'] a[href^='/products/']").last();
    await expect(last).not.toBeInViewport();
    await page.getByRole("button", { name: "Next Fresh" }).click();
    await expect(last).toBeInViewport();
  });

  test("a slider of hand-picked products keeps their order", async ({ page, request }) => {
    expect((await put(request, { type: "product-slider", config: { title: "Mine", source: "picks", picks: ["e2e-alpha-item", "e2e-beta-item"], perView: 4, showViewAll: false } })).ok()).toBeTruthy();
    await page.goto("/");
    const links = await page.locator("section[aria-label='Mine'] a[href^='/products/']").evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("href")))]);
    expect(links).toEqual(["/products/e2e-alpha-item", "/products/e2e-beta-item"]);
    await expect(page.getByRole("button", { name: "Next Mine" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "View all →" })).toHaveCount(0);
  });

  test("a category slider lists categories with product counts and slides to the rest", async ({ page, request }) => {
    expect((await put(request, { type: "category-slider", config: { title: "Aisles", perView: 2, limit: 12 } })).ok()).toBeTruthy();
    await page.goto("/");

    const tile = (slug: string) => page.locator(`section[aria-label='Aisles'] a[href="/products?category=${slug}"]`);
    await expect(tile("e2e-alpha")).toContainText("1 product");
    await expect(tile("e2e-alpha")).toBeInViewport();
    await expect(tile("e2e-beta")).toBeInViewport();
    await expect(tile("home-living")).not.toBeInViewport();
    await page.getByRole("button", { name: "Next Aisles" }).click();
    await expect(tile("home-living")).toBeInViewport();

    await tile("home-living").click();
    await expect(page).toHaveURL(/category=home-living/);
  });

  test("the category slider respects the limit", async ({ page, request }) => {
    expect((await put(request, { type: "category-slider", config: { title: "Few", perView: 4, limit: 1 } })).ok()).toBeTruthy();
    await page.goto("/");
    await expect(page.locator("section[aria-label='Few'] a[href^='/products?category=']")).toHaveCount(1);
  });

  test("a product collection with a card size keeps every card the same width", async ({ page, request }) => {
    const widthOfFirstCard = async () => {
      await page.goto("/");
      const box = await page.locator("section:has(h2:text-is('Sized')) .grid > div").first().boundingBox();
      return Math.round(box!.width);
    };
    const publish = (limit: number, cardSize: string) => put(request, { type: "products", config: { title: "Sized", source: "new", limit, columns: 3, cardSize, layout: "grid" } });

    expect((await publish(2, "medium")).ok()).toBeTruthy();
    const two = await widthOfFirstCard();
    expect((await publish(4, "medium")).ok()).toBeTruthy();
    const four = await widthOfFirstCard();
    expect(two).toBe(240);
    expect(four).toBe(240);

    expect((await publish(4, "small")).ok()).toBeTruthy();
    expect(await widthOfFirstCard()).toBe(180);

    // Without a card size the cards share the row: 3 per row is wider than a medium card.
    expect((await publish(2, "auto")).ok()).toBeTruthy();
    expect(await widthOfFirstCard()).toBeGreaterThan(300);
  });

  test("both sliders can be added and set up in the admin", async ({ page, request }) => {
    await request.delete(`${API}/admin/home-layout`, { headers: asBrowser });
    await page.goto("/admin/home");
    await page.getByRole("button", { name: "+ Add widget" }).click();
    await page.getByRole("button", { name: /^Product slider/ }).click();
    await expect(page.getByLabel(/^Products visible at once/)).toContainText("4");
    await pick(page.getByLabel(/^Products visible at once/), "3");

    await page.getByRole("button", { name: "+ Add widget" }).click();
    await page.getByRole("button", { name: /^Category slider/ }).click();
    await pick(page.getByLabel(/^Which categories/), "all");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved. Your home page is updated.")).toBeVisible();
    await expect(page.getByText(/Best sellers.*3 at a time/)).toBeVisible();
    await expect(page.getByText(/all categories · 4 at a time/)).toBeVisible();
  });
});
