import { expect, test, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES, money } from "./data";
import { adminProduct, asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const shipping = { name: "Rice Buyer", phone: "9876500033", line1: "33 Grain Road", city: "Pune", state: "Maharashtra", pincode: "411001" };

type Option = { id: string; label: string; pricePaise: number; mrpPaise: number | null; stock?: number; inStock?: boolean };

test.describe.serial("one product in several sizes", () => {
  let categoryId = "";
  let productId = "";
  let ids: Record<string, string> = {};
  let buyer: BrowserContext;

  const dto = (over: Record<string, unknown>) => ({
    name: "E2E Basmati Rice", slug: "e2e-basmati-rice", description: "Sold in sizes.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], sku: "E2E-RICE", showAddToCart: true, pricePaise: 1, stock: 0,
    options: [
      { label: "1 kg", pricePaise: 8000, mrpPaise: 9000, stock: 10 },
      { label: "25 kg", pricePaise: 180000, mrpPaise: 210000, stock: 4, costPaise: 150000 },
      { label: "50 kg", pricePaise: 340000, stock: 0 },
    ],
    ...over,
  });
  const optionsOf = async (request: import("@playwright/test").APIRequestContext) => {
    const res = await request.get(`${API}/admin/products/${productId}`, { headers: asBrowser });
    return (await res.json()) as { pricePaise: number; mrpPaise: number | null; stock: number; options: Option[] };
  };

  test.beforeAll(async ({ browser, request }) => {
    const cats = (await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[];
    categoryId = cats[0].id;
    const res = await request.post(`${API}/admin/products`, { data: dto({}), headers: asBrowser });
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = (await res.json()) as { id: string; options: Option[] };
    productId = body.id;
    ids = Object.fromEntries(body.options.map((o) => [o.label, o.id]));
    buyer = await newCustomer(browser, "Rice Buyer");
  });

  test.afterAll(async ({ request }) => {
    await buyer.close();
    // It has orders, so it is unpublished rather than deleted.
    await request.put(`${API}/admin/products/${productId}`, { data: dto({ status: "DRAFT" }), headers: asBrowser });
  });

  test("the product takes the lowest price and the total stock from its sizes", async ({ request }) => {
    const p = await optionsOf(request);
    expect(p).toMatchObject({ pricePaise: 8000, mrpPaise: 9000, stock: 14 });
    expect(p.options.map((o) => o.label)).toEqual(["1 kg", "25 kg", "50 kg"]);
  });

  test("shoppers see each size's price and whether it is in stock, never the stock or cost", async ({ request }) => {
    const pub = (await (await request.get(`${API}/products/e2e-basmati-rice`)).json()) as { pricePaise: number; inStock: boolean; options: Record<string, unknown>[] };
    expect(pub).toMatchObject({ pricePaise: 8000, inStock: true });
    expect(pub.options.map((o) => [o.label, o.pricePaise, o.inStock])).toEqual([["1 kg", 8000, true], ["25 kg", 180000, true], ["50 kg", 340000, false]]);
    for (const o of pub.options) for (const secret of ["stock", "costPaise"]) expect(o, secret).not.toHaveProperty(secret);
  });

  test("bad sizes are refused", async ({ request }) => {
    const post = (over: Record<string, unknown>) => request.post(`${API}/admin/products`, { data: dto({ slug: "e2e-bad-rice", sku: "E2E-BAD-RICE", ...over }), headers: asBrowser });
    const twice = await post({ options: [{ label: "1 kg", pricePaise: 100, stock: 1 }, { label: "1  KG", pricePaise: 200, stock: 1 }] });
    expect(twice.status()).toBe(400);
    expect(await twice.text()).toContain("listed twice");
    const mrp = await post({ options: [{ label: "1 kg", pricePaise: 500, mrpPaise: 400, stock: 1 }] });
    expect(mrp.status()).toBe(400);
    const sale = await post({ salePricePaise: 100, saleEndsAt: new Date(Date.now() + 3_600_000).toISOString() });
    expect(sale.status()).toBe(400);
    expect(await sale.text()).toContain("timed sale");
    const partner = await post({ productType: "AFFILIATE", platform: "Amazon", affiliateUrl: "https://amazon.in/x", sku: undefined, stock: undefined });
    expect(partner.status()).toBe(400);
    expect(await partner.text()).toContain("Only products sold by");
  });

  test("the product page changes price with the chosen size and sold-out sizes cannot be picked", async ({ page }) => {
    await page.goto("/products/e2e-basmati-rice");
    const price = page.getByTestId("option-price");
    await expect(page.getByRole("radio", { name: "1 kg" })).toHaveAttribute("aria-checked", "true");
    await expect(price).toHaveText(money(8000));
    await expect(page.getByText("Save 11%")).toBeVisible();
    await page.getByRole("radio", { name: "25 kg" }).click();
    await expect(price).toHaveText(money(180000));
    await expect(page.getByText("Save 14%")).toBeVisible();
    await expect(page.getByRole("radio", { name: /50 kg/ })).toBeDisabled();
  });

  test("the card says From and asks for a size instead of adding to the cart", async ({ page, request }) => {
    const p = await optionsOf(request);
    expect(p.options.length).toBe(3);
    const row = await adminProduct(request, "e2e-basmati-rice");
    expect(row.id).toBe(productId);
    await page.goto("/products?q=Basmati");
    const card = page.getByRole("heading", { name: "E2E Basmati Rice" }).locator("xpath=ancestor::div[contains(@class,'group')][1]");
    await expect(card.getByText("From")).toBeVisible();
    await expect(card.getByText(money(8000))).toBeVisible();
    await expect(card.getByRole("link", { name: "Select options" })).toHaveAttribute("href", "/products/e2e-basmati-rice");
    await expect(card.getByRole("button", { name: "Add to cart" })).toHaveCount(0);
  });

  test("two sizes of the same product are two lines in the cart, each at its own price", async ({ page }) => {
    await page.goto("/products/e2e-basmati-rice");
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await page.getByRole("radio", { name: "25 kg" }).click();
    await page.getByRole("button", { name: /Add to Cart|Added to cart/ }).first().click();
    await page.goto("/cart");
    const rows = page.getByRole("listitem").filter({ hasText: "E2E Basmati Rice" });
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: "Size: 1 kg" })).toContainText(money(8000));
    await expect(rows.filter({ hasText: "Size: 25 kg" })).toContainText(money(180000));
    await expect(page.getByText("Items (2)").locator("..")).toContainText(money(188000));

    await rows.filter({ hasText: "Size: 25 kg" }).getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.getByText("Items (3)").locator("..")).toContainText(money(368000));
    await rows.filter({ hasText: "Size: 25 kg" }).getByRole("button", { name: /^Remove/ }).click();
    await expect(rows).toHaveCount(1);
    await page.evaluate(() => localStorage.removeItem("dmg-cart"));
  });

  test("an order is charged the chosen size's price and takes that size's stock", async ({ request }) => {
    const quote = (await (await request.post(`${API}/checkout/quote`, { data: { items: [{ productId, optionId: ids["25 kg"], quantity: 2 }, { productId, optionId: ids["1 kg"], quantity: 1 }] }, headers: asBrowser })).json()) as {
      subtotalPaise: number; unavailable: string[]; lines: { optionId: string; unitPaise: number }[];
    };
    expect(quote.subtotalPaise).toBe(2 * 180000 + 8000);
    expect(quote.unavailable).toEqual([]);
    expect(quote.lines.map((l) => [l.optionId, l.unitPaise])).toEqual([[ids["25 kg"], 180000], [ids["1 kg"], 8000]]);

    const res = await buyer.request.post(`${API}/orders`, { data: { items: [{ productId, optionId: ids["25 kg"], quantity: 2 }, { productId, optionId: ids["1 kg"], quantity: 1 }], shipping, paymentMethod: "COD" }, headers: asBrowser });
    expect(res.status(), await res.text()).toBe(201);
    const { order } = (await res.json()) as { order: { id: string; subtotalPaise: number; items: { optionLabel: string; pricePaise: number; quantity: number; costPaise: number | null }[] } };
    expect(order.subtotalPaise).toBe(368000);
    expect(order.items.map((i) => [i.optionLabel, i.pricePaise, i.quantity, i.costPaise])).toEqual(expect.arrayContaining([["25 kg", 180000, 2, 150000], ["1 kg", 8000, 1, null]]));

    const after = await optionsOf(request);
    expect(Object.fromEntries(after.options.map((o) => [o.label, o.stock]))).toEqual({ "1 kg": 9, "25 kg": 2, "50 kg": 0 });
    expect(after.stock).toBe(11);

    // The customer and the admin both see which size was bought.
    const mine = (await (await buyer.request.get(`${API}/orders`, { headers: asBrowser })).json()) as { items: { optionLabel: string | null }[] }[];
    expect(mine[0].items.map((i) => i.optionLabel).sort()).toEqual(["1 kg", "25 kg"]);

    // Cancelling puts each size back on the shelf.
    const cancel = await buyer.request.post(`${API}/orders/${order.id}/cancel`, { data: { reason: "Ordered by mistake" }, headers: asBrowser });
    expect(cancel.ok(), await cancel.text()).toBeTruthy();
    const restored = await optionsOf(request);
    expect(Object.fromEntries(restored.options.map((o) => [o.label, o.stock]))).toEqual({ "1 kg": 10, "25 kg": 4, "50 kg": 0 });
    expect(restored.stock).toBe(14);
  });

  test("an order must name a size, and a sold-out or unknown size is refused", async () => {
    const order = (items: unknown[]) => buyer.request.post(`${API}/orders`, { data: { items, shipping, paymentMethod: "COD" }, headers: asBrowser });
    const none = await order([{ productId, quantity: 1 }]);
    expect(none.status()).toBe(400);
    expect(await none.text()).toContain("Choose a size");
    const unknown = await order([{ productId, optionId: "nope", quantity: 1 }]);
    expect(unknown.status()).toBe(400);
    const sold = await order([{ productId, optionId: ids["50 kg"], quantity: 1 }]);
    expect(sold.status()).toBe(409);
    const tooMany = await order([{ productId, optionId: ids["25 kg"], quantity: 5 }]);
    expect(tooMany.status()).toBe(409);
  });

  test("a quote leaves out a size that is missing", async ({ request }) => {
    const q = (await (await request.post(`${API}/checkout/quote`, { data: { items: [{ productId, quantity: 1 }] }, headers: asBrowser })).json()) as { unavailable: string[]; subtotalPaise: number };
    expect(q.unavailable).toEqual([productId]);
    expect(q.subtotalPaise).toBe(0);
  });

  test("an edit that doesn't mention sizes keeps them", async ({ request }) => {
    const { options: _omit, ...withoutOptions } = dto({ featured: true });
    const res = await request.put(`${API}/admin/products/${productId}`, { data: withoutOptions, headers: asBrowser });
    expect(res.ok(), await res.text()).toBeTruthy();
    const p = await optionsOf(request);
    expect(p.options.map((o) => o.id).sort()).toEqual(Object.values(ids).sort());
    expect(p).toMatchObject({ pricePaise: 8000, stock: 14 });
  });

  test("the admin form edits sizes in place and adds a new one", async ({ page, request }) => {
    await page.goto(`/admin/products/${productId}`);
    await expect(page.getByLabel("Option 2 Size")).toHaveValue("25 kg");
    await expect(page.getByLabel("Selling price (₹)")).toBeDisabled();
    await expect(page.getByLabel("Selling price (₹)")).toHaveValue("80");
    await page.getByLabel("Option 2 price").fill("1750");
    await page.getByRole("button", { name: "+ Add option" }).click();
    await page.getByLabel("Option 4 Size").fill("5 kg");
    await page.getByLabel("Option 4 price").fill("450");
    await page.getByLabel("Option 4 stock").fill("7");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);

    const p = await optionsOf(request);
    const byLabel = Object.fromEntries(p.options.map((o) => [o.label, o]));
    // The size that was edited keeps its id, so carts and orders still point at it.
    expect(byLabel["25 kg"]).toMatchObject({ id: ids["25 kg"], pricePaise: 175000 });
    expect(byLabel["5 kg"]).toMatchObject({ pricePaise: 45000, stock: 7 });
    expect(p.stock).toBe(21);

    // Removing every size goes back to one price.
    await page.goto(`/admin/products/${productId}`);
    for (let n = 4; n >= 1; n--) await page.getByRole("button", { name: `Remove option ${n}` }).click();
    await expect(page.getByLabel("Selling price (₹)")).toBeEnabled();
    // The last size's price and MRP carry over to the single price fields.
    await expect(page.getByLabel("Selling price (₹)")).toHaveValue("80");
    await expect(page.getByLabel(/^MRP \(₹\)/)).toHaveValue("90");
    await page.getByLabel("Selling price (₹)").fill("120");
    await page.getByLabel(/^MRP \(₹\)/).fill("");
    await page.getByLabel("Stock quantity").fill("5");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    const plain = await optionsOf(request);
    expect(plain).toMatchObject({ pricePaise: 12000, stock: 5, options: [] });
  });
});
