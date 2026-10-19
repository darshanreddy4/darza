import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES, WEB } from "./data";
import { asBrowser, newCustomer, pick } from "./helpers";

test.use({ storageState: AUTH_FILES.admin, viewport: { width: 1280, height: 900 } });

const signedOut = { cookies: [], origins: [] };
const shipping = { name: "Delivery Buyer", phone: "9876500041", line1: "41 Rule Road", city: "Pune", state: "Maharashtra", pincode: "411001" };
const ids: Record<string, string> = {};

type Settings = Record<string, unknown> & { freeShippingOverPaise: number | null };

// The settings form sends every field, so changes start from what is saved.
async function saveSettings(request: APIRequestContext, over: Record<string, unknown>) {
  const s = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Settings;
  const body = {
    shippingFeePaise: s.shippingFeePaise, freeShippingOverPaise: s.freeShippingOverPaise ?? 0, gstEnabled: s.gstEnabled, gstin: s.gstin ?? "", legalName: s.legalName ?? "",
    businessAddress: s.businessAddress ?? "", businessState: s.businessState ?? "", shippingGstPercent: s.shippingGstPercent, invoicePrefix: s.invoicePrefix, ...over,
  };
  const res = await request.put(`${API}/admin/settings`, { data: body, headers: asBrowser });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()) as Settings;
}

interface Quote {
  shippingPaise: number; totalPaise: number; subtotalPaise: number; freeShippingGapPaise: number; earnedGifts: string[];
  delivery: { standardPaise: number; specialPaise: number; freeBecause: "ALL" | "THRESHOLD" | null; freeAllGapPaise: number };
  rewards: { milestones: { kind: string; title: string; atPaise: number; reached: boolean }[]; next: { title: string; remainingPaise: number } | null };
}

test.describe.serial("delivery charges, areas and gifts", () => {
  let categoryId = "";
  let original: Settings;
  let buyer: BrowserContext;

  const dto = (over: Record<string, unknown>) => ({ description: "Used to test delivery rules.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], stock: 40, ...over });
  const create = async (request: APIRequestContext, slug: string, over: Record<string, unknown>) => {
    const res = await request.post(`${API}/admin/products`, { data: dto({ name: `E2E ${slug}`, slug, sku: slug.toUpperCase(), ...over }), headers: asBrowser });
    expect(res.ok(), await res.text()).toBeTruthy();
    ids[slug] = (await res.json()).id;
  };
  const quote = async (request: APIRequestContext, basket: [string, number][], pincode?: string) => {
    const res = await request.post(`${API}/checkout/quote`, { data: { items: basket.map(([slug, quantity]) => ({ productId: ids[slug], quantity })), pincode }, headers: asBrowser });
    expect(res.ok(), await res.text()).toBeTruthy();
    return (await res.json()) as Quote;
  };
  const putCart = (page: import("@playwright/test").Page, basket: [string, number, number][]) =>
    page.evaluate((lines) => localStorage.setItem("dmg-cart", JSON.stringify(lines.map(([id, slug, pricePaise, quantity]) => ({ productId: id, slug, name: `E2E ${slug}`, image: null, pricePaise, quantity })))),
      basket.map(([slug, price, quantity]) => [ids[slug], slug, price, quantity] as [string, string, number, number]));

  test.beforeAll(async ({ browser, request }) => {
    const cats = (await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[];
    categoryId = cats[0].id;
    original = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Settings;
    // Fee 50, free over 500 for regular items, everything free over 1500, North East pays 99 and is never free by amount.
    await saveSettings(request, {
      shippingFeePaise: 5000, freeShippingOverPaise: 50000, freeAllOverPaise: 150000,
      deliveryZones: [{ name: "North East", pincodes: ["79"], feePaise: 9900, freeOverPaise: 0 }],
      giftTiers: [{ atPaise: 100000, title: "Free tote bag" }],
    });
    await create(request, "e2e-del-big", { pricePaise: 60000 });
    await create(request, "e2e-del-small", { pricePaise: 20000 });
    await create(request, "e2e-del-heavy", { pricePaise: 20000, chargeDelivery: true, deliveryFeePaise: 29900 });
    await create(request, "e2e-del-heavy-default", { pricePaise: 10000, chargeDelivery: true });
    await create(request, "e2e-del-free", { pricePaise: 10000, freeDelivery: true, deliveryDays: 2 });
    buyer = await newCustomer(browser, "Delivery Buyer");
  });

  test.afterAll(async ({ request }) => {
    await buyer.close();
    await saveSettings(request, {
      shippingFeePaise: original.shippingFeePaise, freeShippingOverPaise: original.freeShippingOverPaise ?? 0, freeAllOverPaise: original.freeAllOverPaise ?? 0,
      deliveryZones: original.deliveryZones, giftTiers: original.giftTiers,
    });
    for (const [slug, id] of Object.entries(ids)) {
      const res = await request.put(`${API}/admin/products/${id}`, { data: dto({ name: `E2E ${slug}`, slug, sku: slug.toUpperCase(), pricePaise: 1000, status: "DRAFT" }), headers: asBrowser });
      if (!res.ok()) await request.delete(`${API}/admin/products/${id}`, { headers: asBrowser });
    }
  });

  test("scenario 1: regular items ship free once they reach the free-delivery amount", async ({ request }) => {
    const under = await quote(request, [["e2e-del-small", 2]]);
    expect(under).toMatchObject({ shippingPaise: 5000, freeShippingGapPaise: 10000, totalPaise: 45000 });
    const over = await quote(request, [["e2e-del-big", 1]]);
    expect(over).toMatchObject({ shippingPaise: 0, totalPaise: 60000 });
    expect(over.delivery.freeBecause).toBe("THRESHOLD");
  });

  test("scenario 2: a heavy item always pays delivery, its own fee or the store's", async ({ request }) => {
    expect((await quote(request, [["e2e-del-heavy", 1]])).shippingPaise).toBe(29900);
    expect((await quote(request, [["e2e-del-heavy-default", 1]])).shippingPaise).toBe(5000);
    // Spending a lot on the heavy item alone does not make it free until the whole order is big enough.
    expect((await quote(request, [["e2e-del-heavy", 5]])).shippingPaise).toBe(29900);
    // An always-free item costs nothing, and adds to the regular items' amount.
    expect((await quote(request, [["e2e-del-free", 1]])).shippingPaise).toBe(0);
    expect((await quote(request, [["e2e-del-free", 3], ["e2e-del-small", 1]])).shippingPaise).toBe(0);
  });

  test("scenario 3: with a big regular item and a heavy one, only the heavy item's delivery is charged", async ({ request }) => {
    const q = await quote(request, [["e2e-del-big", 1], ["e2e-del-heavy", 1]]);
    expect(q).toMatchObject({ shippingPaise: 29900, totalPaise: 80000 + 29900 });
    expect(q.delivery).toMatchObject({ standardPaise: 0, specialPaise: 29900 });
    const small = await quote(request, [["e2e-del-small", 1], ["e2e-del-heavy", 1]]);
    expect(small.delivery).toMatchObject({ standardPaise: 5000, specialPaise: 29900 });
    // Money spent on the heavy item counts towards the free-delivery amount of the small regular item.
    const topped = await quote(request, [["e2e-del-small", 1], ["e2e-del-heavy", 2]]);
    expect(topped.delivery).toMatchObject({ standardPaise: 0, specialPaise: 29900 });
    expect(topped.freeShippingGapPaise).toBe(0);
  });

  test("scenario 4: once the whole order passes the free-everything amount, all delivery is free", async ({ request }) => {
    const near = await quote(request, [["e2e-del-big", 2], ["e2e-del-heavy", 1]]);
    expect(near.shippingPaise).toBe(29900);
    expect(near.delivery.freeAllGapPaise).toBe(10000);
    const over = await quote(request, [["e2e-del-big", 2], ["e2e-del-heavy", 2]]);
    expect(over).toMatchObject({ shippingPaise: 0, totalPaise: 160000 });
    expect(over.delivery.freeBecause).toBe("ALL");
  });

  test("an area with its own fee changes the charge, and the free-everything amount still waives it", async ({ request }) => {
    expect((await quote(request, [["e2e-del-big", 1]], "794001")).shippingPaise).toBe(9900);
    expect((await quote(request, [["e2e-del-big", 1]], "411001")).shippingPaise).toBe(0);
    expect((await quote(request, [["e2e-del-big", 1]])).shippingPaise).toBe(0);
    expect((await quote(request, [["e2e-del-heavy-default", 1]], "794001")).shippingPaise).toBe(9900);
    expect((await quote(request, [["e2e-del-big", 3]], "794001")).shippingPaise).toBe(0);
    expect(((await (await request.get(`${API}/store/delivery?pincode=794001`)).json()) as { zone: string; feePaise: number }).feePaise).toBe(9900);
    expect(((await (await request.get(`${API}/store/delivery?pincode=411001`)).json()) as { zone: string | null }).zone).toBeNull();
  });

  test("the quote lists the rewards still to unlock, and the gifts earned", async ({ request }) => {
    const q = await quote(request, [["e2e-del-small", 1]]);
    expect(q.rewards.milestones.map((m) => [m.kind, m.title, m.reached])).toEqual([["delivery", "Free delivery", false], ["gift", "Free tote bag", false]]);
    expect(q.rewards.next).toEqual({ title: "Free delivery", remainingPaise: 30000 });
    expect(q.earnedGifts).toEqual([]);
    const mixed = await quote(request, [["e2e-del-small", 1], ["e2e-del-heavy", 1]]);
    expect(mixed.rewards.milestones.map((m) => m.kind)).toEqual(["delivery", "gift", "delivery-all"]);
    const big = await quote(request, [["e2e-del-big", 2]]);
    expect(big.earnedGifts).toEqual(["Free tote bag"]);
    expect(big.rewards.next).toBeNull();
  });

  test("an order is charged what the quote said, and keeps the gifts it earned", async ({ request }) => {
    const place = async (basket: [string, number][]) => {
      const res = await buyer.request.post(`${API}/orders`, { data: { items: basket.map(([slug, quantity]) => ({ productId: ids[slug], quantity })), shipping, paymentMethod: "COD" }, headers: asBrowser });
      expect(res.status(), await res.text()).toBe(201);
      return ((await res.json()) as { order: { id: string; shippingPaise: number; totalPaise: number; gifts: string[] } }).order;
    };
    const a = await place([["e2e-del-big", 1], ["e2e-del-heavy", 1]]);
    expect(a).toMatchObject({ shippingPaise: 29900, totalPaise: 109900, gifts: [] });
    const b = await place([["e2e-del-big", 2], ["e2e-del-heavy", 1]]);
    expect(b).toMatchObject({ shippingPaise: 29900, totalPaise: 169900, gifts: ["Free tote bag"] });
    const c = await place([["e2e-del-big", 2], ["e2e-del-heavy", 2]]);
    expect(c).toMatchObject({ shippingPaise: 0, totalPaise: 160000, gifts: ["Free tote bag"] });
  });

  test("product pages say what delivery costs, and the PIN code check says what it costs there", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    const strip = page.getByRole("list", { name: "Buying with confidence" });
    await page.goto("/products/e2e-del-big");
    await expect(strip).toContainText("Free delivery over \u20b9500");
    await page.goto("/products/e2e-del-heavy");
    await expect(strip).toContainText("Delivery \u20b9299");
    await expect(strip.getByText("Free delivery")).toHaveCount(0);
    await page.goto("/products/e2e-del-free");
    await expect(strip.getByText("Free delivery", { exact: true })).toBeVisible();

    await page.goto("/products/e2e-del-heavy");
    const box = page.getByRole("region", { name: "Delivery to your PIN code" });
    await box.getByRole("textbox", { name: "PIN code" }).fill("794001");
    await box.getByRole("button", { name: "Check" }).click();
    await expect(box).toContainText("Delivery charge \u20b9299 for this item");
    await expect(box).toContainText("Everything ships free on orders of \u20b91,500 or more");
    // The PIN code is remembered, so another product answers for the same area.
    await page.goto("/products/e2e-del-big");
    await expect(box).toContainText("Delivery \u20b999");
    await ctx.close();
  });

  test("the cart shows a progress line to free delivery and gifts, and it fills as items are added", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    await putCart(page, [["e2e-del-small", 20000, 1]]);
    await page.goto("/cart");
    const bar = page.getByRole("region", { name: "Rewards for your order" });
    await expect(bar).toContainText("more to get Free delivery");
    await expect(page.locator("aside")).toContainText("\u20b950");
    await expect(bar.getByRole("button", { name: "Free tote bag" })).toBeVisible();
    await bar.getByRole("button", { name: "Free tote bag" }).hover();
    await expect(bar).toContainText("to go");

    const more = page.getByRole("button", { name: "Increase quantity" });
    await more.click();
    await more.click();
    await expect(bar).toContainText("more to get Free tote bag");
    await expect(page.locator("aside").getByText("Free", { exact: true })).toBeVisible();
    await more.click();
    await more.click();
    await expect(bar).toContainText("You have unlocked every reward");
    await expect(page.locator("aside")).toContainText("Free tote bag");

    // A heavy item keeps its own charge, and the line shows the goal for everything.
    await putCart(page, [["e2e-del-big", 60000, 1], ["e2e-del-heavy", 20000, 1]]);
    await page.goto("/cart");
    await expect(page.locator("aside")).toContainText("For heavy or bulky items in your basket.");
    await expect(page.locator("aside")).toContainText("more and delivery is free on everything");
    await expect(bar.getByRole("button", { name: "Free delivery on everything" })).toBeVisible();
    await ctx.close();
  });

  test("checkout prices delivery for the PIN code typed, and shows the progress line", async () => {
    const page = await buyer.newPage();
    await page.goto("/");
    await putCart(page, [["e2e-del-big", 60000, 1]]);
    await page.goto("/checkout");
    await expect(page.getByRole("region", { name: "Rewards for your order" })).toBeVisible();
    const summary = page.locator("aside");
    await expect(summary).not.toContainText("Calculating");
    await expect(summary.getByText("Free", { exact: true })).toBeVisible();
    await page.getByPlaceholder("Pincode").fill("794001");
    await expect(summary).toContainText("\u20b999");
    await page.getByPlaceholder("Pincode").fill("411001");
    await expect(summary.getByText("Free", { exact: true })).toBeVisible();
    await page.close();
  });

  test("gifts an order earned show on the customer's orders and on the admin's order, for packing", async ({ page }) => {
    const mine = await buyer.newPage();
    await mine.goto("/orders");
    await expect(mine.getByText("Free gift with this order: Free tote bag").first()).toBeVisible();
    await mine.close();
    await page.goto("/admin/orders");
    await page.getByRole("button", { name: /^#/ }).first().click();
    await expect(page.getByText("Pack with this order: Free tote bag").first()).toBeVisible();
  });

  test("the admin sets a product's delivery charge on its edit page", async ({ page, request }) => {
    await page.goto(`/admin/products/${ids["e2e-del-small"]}`);
    await pick(page.getByRole("button", { name: "Delivery charge", exact: true }), "charge");
    await page.getByLabel("Delivery charge (\u20b9)").fill("150");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    expect(await (await request.get(`${API}/products/e2e-del-small`)).json()).toMatchObject({ chargeDelivery: true, deliveryFeePaise: 15000, freeDelivery: false });

    await page.goto(`/admin/products/${ids["e2e-del-small"]}`);
    await pick(page.getByRole("button", { name: "Delivery charge", exact: true }), "free");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    expect(await (await request.get(`${API}/products/e2e-del-small`)).json()).toMatchObject({ chargeDelivery: false, deliveryFeePaise: null, freeDelivery: true });
  });

  test("the admin sets delivery areas and gifts in settings", async ({ page, request }) => {
    await saveSettings(request, { deliveryZones: [], giftTiers: [] });
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Add a delivery area" }).click();
    await page.getByLabel("Area name").fill("Islands");
    await page.getByLabel("PIN codes starting with").fill("744, 682553");
    await page.getByLabel("Area delivery fee").fill("199");
    await page.getByRole("button", { name: "Add a gift" }).click();
    await page.getByLabel("Gift order amount").fill("2000");
    await page.getByLabel("Gift", { exact: true }).fill("Free water bottle");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();
    const saved = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Settings;
    expect(saved.deliveryZones).toEqual([{ name: "Islands", pincodes: ["744", "682553"], feePaise: 19900, freeOverPaise: null }]);
    expect(saved.giftTiers).toEqual([{ atPaise: 200000, title: "Free water bottle" }]);

    await page.getByLabel("PIN codes starting with").fill("744, x1");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "PIN code starts must be 1 to 6 digits" })).toBeVisible();
  });
});
