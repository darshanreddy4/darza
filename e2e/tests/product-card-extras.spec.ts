import { expect, test, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES, money } from "./data";
import { asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const shipping = { name: "Card Buyer", phone: "9876500011", line1: "11 Card Road", city: "Pune", state: "Maharashtra", pincode: "411001" };

test.describe.serial("richer product cards", () => {
  let categoryId = "";
  let potId = "";
  let plainId = "";
  let buyer: BrowserContext;
  let rater: BrowserContext;

  const dto = (over: Record<string, unknown>) => ({
    description: "Used to test the product card.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], mrpPaise: 113500, pricePaise: 56800, stock: 40, ...over,
  });

  test.beforeAll(async ({ browser, request }) => {
    const cats = (await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[];
    categoryId = cats[0].id;
    const pot = await request.post(`${API}/admin/products`, {
      data: dto({ name: "E2E Card Casserole", slug: "e2e-card-casserole", sku: "E2E-CARD-POT", stock: 6, packSize: "600 ml, 800 ml, 1100 ml", saleTag: "TOP_DISCOUNT", multiBuyQty: 2, multiBuyPercent: 3 }), headers: asBrowser,
    });
    expect(pot.ok(), await pot.text()).toBeTruthy();
    potId = (await pot.json()).id;
    const plain = await request.post(`${API}/admin/products`, { data: dto({ name: "E2E Card Plain Pot", slug: "e2e-card-plain-pot", sku: "E2E-CARD-PLAIN", mrpPaise: undefined, pricePaise: 20000 }), headers: asBrowser });
    expect(plain.ok(), await plain.text()).toBeTruthy();
    plainId = (await plain.json()).id;

    // Two bought, which leaves four in stock: at or under the store's low-stock level of five.
    buyer = await newCustomer(browser, "Card Buyer");
    const order = await buyer.request.post(`${API}/orders`, { data: { items: [{ productId: potId, quantity: 2 }], shipping, paymentMethod: "COD" }, headers: asBrowser });
    expect(order.status(), await order.text()).toBe(201);
    expect((await buyer.request.post(`${API}/products/e2e-card-casserole/reviews`, { data: { rating: 5, body: "Keeps food hot for hours." }, headers: asBrowser })).ok()).toBeTruthy();
    rater = await newCustomer(browser, "Card Rater");
    expect((await rater.request.post(`${API}/products/e2e-card-plain-pot/reviews`, { data: { rating: 2, body: "Lid does not fit well." }, headers: asBrowser })).ok()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    await buyer.close(); await rater.close();
    // Products with orders cannot be deleted, so both are unpublished to stay out of other tests' lists.
    for (const [slug, sku] of [["e2e-card-casserole", "E2E-CARD-POT"], ["e2e-card-plain-pot", "E2E-CARD-PLAIN"]]) {
      const list = (await (await request.get(`${API}/admin/products?q=${slug}`, { headers: asBrowser })).json()) as { id: string; slug: string; name: string }[];
      const p = list.find((x) => x.slug === slug);
      if (p) await request.put(`${API}/admin/products/${p.id}`, { data: dto({ name: p.name, slug, sku, status: "DRAFT" }), headers: asBrowser });
    }
  });

  test("the public product carries the new labels but never the exact stock", async ({ request }) => {
    const pot = (await (await request.get(`${API}/products/e2e-card-casserole`)).json()) as Record<string, unknown>;
    expect(pot).toMatchObject({ packSize: "600 ml, 800 ml, 1100 ml", saleTag: "TOP_DISCOUNT", lowStock: true, soldCount: 2, multiBuy: { qty: 2, percent: 3 }, ratingAvg: 5, ratingCount: 1 });
    for (const secret of ["stock", "multiBuyQty", "multiBuyPercent", "showSold"]) expect(pot, secret).not.toHaveProperty(secret);
    const plain = (await (await request.get(`${API}/products/e2e-card-plain-pot`)).json()) as Record<string, unknown>;
    expect(plain).toMatchObject({ packSize: null, saleTag: null, lowStock: false, soldCount: 0, multiBuy: null });
  });

  test("the card shows pack size, a rating badge, units bought, the tag and the multi-buy offer", async ({ page }) => {
    await page.goto("/products?type=OWN");
    const card = page.getByRole("heading", { name: "E2E Card Casserole" }).locator("xpath=ancestor::div[contains(@class,'group')][1]");
    await expect(card.getByText("600 ml, 800 ml, 1100 ml")).toBeVisible();
    await expect(card.getByText("2 bought")).toBeVisible();
    await expect(card.getByText("Only few left")).toBeVisible();
    await expect(card.getByText("Top Discount of the Sale")).toBeVisible();
    await expect(card.getByText("Buy 2 items, save extra 3%")).toBeVisible();
    await expect(card.getByText("50% off")).toBeVisible();
    const good = card.getByRole("img", { name: "Rated 5 out of 5 by 1 customer" });
    await expect(good).toHaveText("5.0");
    await expect(good).toHaveClass(/bg-green-700/);

    const plain = page.getByRole("heading", { name: "E2E Card Plain Pot" }).locator("xpath=ancestor::div[contains(@class,'group')][1]");
    await expect(plain.getByRole("img", { name: "Rated 2 out of 5 by 1 customer" })).toHaveClass(/bg-red-600/);
    for (const text of ["Only few left", "Top Discount of the Sale", /^Buy \d items/, /bought$/]) await expect(plain.getByText(text)).toHaveCount(0);
  });

  test("the product page shows the same labels", async ({ page }) => {
    await page.goto("/products/e2e-card-casserole");
    const panel = page.getByRole("heading", { level: 1 }).locator("xpath=ancestor::div[contains(@class,'rounded-3xl')][1]");
    await expect(panel.getByText("600 ml, 800 ml, 1100 ml")).toBeVisible();
    await expect(panel.getByText("2 bought")).toBeVisible();
    await expect(panel.getByText("Only few left")).toBeVisible();
    await expect(panel.getByText("Top Discount of the Sale")).toBeVisible();
    await expect(panel.getByText("Buy 2 items, save extra 3%")).toBeVisible();
  });

  test("the multi-buy saving is priced in the quote, the cart and the order", async ({ page, request }) => {
    const quote = async (quantity: number) => (await (await request.post(`${API}/checkout/quote`, { data: { items: [{ productId: potId, quantity }] }, headers: asBrowser })).json()) as {
      subtotalPaise: number; multiBuySavedPaise: number; lines: { unitPaise: number; savedPaise: number; buyMoreFor: { qty: number; percent: number } | null }[];
    };
    const one = await quote(1);
    expect(one.subtotalPaise).toBe(56800);
    expect(one.multiBuySavedPaise).toBe(0);
    expect(one.lines[0].buyMoreFor).toEqual({ qty: 2, percent: 3 });
    const two = await quote(2);
    expect(two.lines[0]).toMatchObject({ unitPaise: 55096, savedPaise: 3408, buyMoreFor: null });
    expect(two.subtotalPaise).toBe(110192);
    expect(two.multiBuySavedPaise).toBe(3408);

    const line = (quantity: number) => JSON.stringify([{ productId: potId, slug: "e2e-card-casserole", name: "E2E Card Casserole", image: null, pricePaise: 56800, quantity }]);
    await page.goto("/");
    await page.evaluate((v) => localStorage.setItem("dmg-cart", v), line(1));
    await page.goto("/cart");
    await expect(page.getByText("Buy 2 items, save extra 3%")).toBeVisible();
    await page.evaluate((v) => localStorage.setItem("dmg-cart", v), line(2));
    await page.goto("/cart");
    await expect(page.getByText(/Multi-buy: you save/)).toContainText(money(3408));
    await expect(page.getByText("Multi-buy savings (already included)")).toBeVisible();
    await expect(page.getByText("Items (2)").locator("..")).toContainText(money(110192));
    await page.evaluate(() => localStorage.removeItem("dmg-cart"));

    // The order placed in setup (two bought) was charged the multi-buy price.
    const orders = (await (await buyer.request.get(`${API}/orders`, { headers: asBrowser })).json()) as { subtotalPaise: number; items: { pricePaise: number; quantity: number }[] }[];
    expect(orders[0].items[0]).toMatchObject({ pricePaise: 55096, quantity: 2 });
    expect(orders[0].subtotalPaise).toBe(110192);
  });

  test("a multi-buy offer needs both numbers and only suits our own products", async ({ request }) => {
    const bad = await request.post(`${API}/admin/products`, { data: dto({ name: "E2E Half Offer", slug: "e2e-half-offer", sku: "E2E-HALF", multiBuyQty: 2 }), headers: asBrowser });
    expect(bad.status()).toBe(400);
    expect(await bad.text()).toContain("both a quantity and a percentage");
    for (const extra of [{ multiBuyQty: 1, multiBuyPercent: 3 }, { multiBuyQty: 2, multiBuyPercent: 90 }, { saleTag: "BEST" }]) {
      const res = await request.post(`${API}/admin/products`, { data: dto({ name: "E2E Bad Offer", slug: "e2e-bad-offer", sku: "E2E-BAD", ...extra }), headers: asBrowser });
      expect(res.status(), JSON.stringify(extra)).toBe(400);
    }
  });

  test("the admin form saves the new fields", async ({ page, request }) => {
    const row = (await (await request.get(`${API}/admin/products?q=e2e-card-plain-pot`, { headers: asBrowser })).json()) as { id: string; slug: string }[];
    await page.goto(`/admin/products/${row.find((p) => p.slug === "e2e-card-plain-pot")!.id}`);
    await page.getByRole("button", { name: "Measured in" }).click();
    await page.getByRole("option", { name: /^Volume/ }).click();
    await page.getByLabel("Pack amount").fill("1750");
    await page.getByRole("button", { name: /^Sale tag/ }).click();
    await page.getByRole("option", { name: "Lowest price in the year" }).click();
    await page.getByLabel(/^Multi-buy offer/).check();
    await page.getByLabel(/^Buy at least/).fill("3");
    await page.getByLabel(/^Save extra/).fill("5");
    await expect(page.getByText("Shown as “Buy 3 items, save extra 5%”.")).toBeVisible();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    const saved = (await (await request.get(`${API}/products/e2e-card-plain-pot`)).json()) as Record<string, unknown>;
    expect(saved).toMatchObject({ packSize: "1750 ml", saleTag: "LOWEST_PRICE", multiBuy: { qty: 3, percent: 5 } });
  });

  test("units bought can be hidden for a product", async ({ request }) => {
    const row = (await (await request.get(`${API}/admin/products?q=e2e-card-casserole`, { headers: asBrowser })).json()) as Record<string, unknown>[];
    const p = row.find((x) => x.slug === "e2e-card-casserole")!;
    const body = { ...dto({}), name: p.name, slug: p.slug, sku: p.sku, stock: p.stock, packSize: p.packSize, saleTag: p.saleTag, multiBuyQty: p.multiBuyQty, multiBuyPercent: p.multiBuyPercent, showSold: false };
    expect((await request.put(`${API}/admin/products/${p.id}`, { data: body, headers: asBrowser })).ok()).toBeTruthy();
    expect(((await (await request.get(`${API}/products/e2e-card-casserole`)).json()) as { soldCount: number }).soldCount).toBe(0);
  });
});
