import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES, WEB } from "./data";
import { asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin, viewport: { width: 1280, height: 900 } });

const json = { ...asBrowser, "content-type": "application/json" };
const signedOut = { cookies: [], origins: [] };
const ids: Record<string, string> = {};

interface Quote {
  subtotalPaise: number; discountPaise: number; rewardDiscountPaise: number; rewardTitle: string | null; shippingPaise: number; totalPaise: number; earnedGifts: string[]; couponError: string | null;
  rewards: { milestones: { kind: string; title: string; reached: boolean }[] };
}

// Rewards on the cart progress line: free delivery, gifts and a percentage off the whole order, plus the delete icon and the party blast.
test.describe.serial("rewards on the progress line", () => {
  let categoryId = "";
  let original: Record<string, unknown>;
  let buyer: BrowserContext & { phone: string };
  const coupons: string[] = [];

  const settings = async (request: APIRequestContext, over: Record<string, unknown>, s = original) => {
    const body = {
      shippingFeePaise: s.shippingFeePaise, freeShippingOverPaise: s.freeShippingOverPaise ?? 0, gstEnabled: s.gstEnabled, gstin: s.gstin ?? "", legalName: s.legalName ?? "",
      businessAddress: s.businessAddress ?? "", businessState: s.businessState ?? "", shippingGstPercent: s.shippingGstPercent, invoicePrefix: s.invoicePrefix, ...over,
    };
    const res = await request.put(`${API}/admin/settings`, { data: body, headers: json });
    expect(res.ok(), await res.text()).toBeTruthy();
  };
  const quote = async (ctx: { request: APIRequestContext }, qty: number, couponCode?: string) => {
    const res = await ctx.request.post(`${API}/checkout/quote`, { data: { items: [{ productId: ids["e2e-rw-a"], quantity: qty }], couponCode }, headers: json });
    return (await res.json()) as Quote;
  };
  const putCart = (page: import("@playwright/test").Page, quantity: number) =>
    page.evaluate(([id, q]) => localStorage.setItem("dmg-cart", JSON.stringify([{ productId: id, slug: "e2e-rw-a", name: "E2E e2e-rw-a", image: null, pricePaise: 60000, quantity: q }])), [ids["e2e-rw-a"], quantity] as const);

  test.beforeAll(async ({ browser, request }) => {
    const cats = (await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[];
    categoryId = cats[0].id;
    original = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Record<string, unknown>;
    await settings(request, {
      shippingFeePaise: 5000, freeShippingOverPaise: 50000, freeAllOverPaise: 0, deliveryZones: [],
      giftTiers: [{ atPaise: 100000, title: "Free surprise gift" }, { atPaise: 200000, title: "5% off your order", kind: "PERCENT", percent: 5, maxDiscountPaise: 10000 }],
    });
    const res = await request.post(`${API}/admin/products`, { data: { name: "E2E e2e-rw-a", slug: "e2e-rw-a", sku: "E2E-RW-A", description: "Used to test rewards.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], stock: 80, pricePaise: 60000 }, headers: asBrowser });
    expect(res.ok(), await res.text()).toBeTruthy();
    ids["e2e-rw-a"] = (await res.json()).id;
    for (const [code, dto] of [["RWFLAT50", { type: "FLAT", value: 5000 }], ["RWTEN", { type: "PERCENT", value: 10 }]] as const) {
      const made = await request.post(`${API}/admin/coupons`, { data: { code, ...dto }, headers: json });
      expect(made.status(), await made.text()).toBe(201);
      ids[code] = (await made.json()).id;
      coupons.push(code);
    }
    buyer = await newCustomer(browser, "Reward Buyer");
  });

  test.afterAll(async ({ request }) => {
    await buyer?.close();
    await settings(request, {
      shippingFeePaise: original.shippingFeePaise, freeShippingOverPaise: original.freeShippingOverPaise ?? 0, freeAllOverPaise: original.freeAllOverPaise ?? 0,
      deliveryZones: original.deliveryZones, giftTiers: original.giftTiers,
    });
    for (const code of coupons) {
      const res = await request.delete(`${API}/admin/coupons/${ids[code]}`, { headers: asBrowser });
      if (!res.ok()) await request.put(`${API}/admin/coupons/${ids[code]}`, { data: { code, type: "FLAT", value: 5000, active: false }, headers: json });
    }
    await request.put(`${API}/admin/products/${ids["e2e-rw-a"]}`, { data: { name: "E2E e2e-rw-a", slug: "e2e-rw-a", sku: "E2E-RW-A", description: "x", categoryId, productType: "OWN", status: "DRAFT", images: [], stock: 80, pricePaise: 1000 }, headers: asBrowser });
  });

  test("the quote lists gifts and percentage rewards, and a percentage reward comes off before any coupon", async ({ browser }) => {
    const guest = await browser.newContext({ storageState: signedOut });
    const one = await quote(guest, 1);
    expect(one.rewards.milestones.map((m) => [m.kind, m.reached])).toEqual([["delivery", true], ["gift", false], ["discount", false]]);
    expect(one).toMatchObject({ rewardDiscountPaise: 0, shippingPaise: 0, totalPaise: 60000 });

    const two = await quote(guest, 2);
    expect(two.earnedGifts).toEqual(["Free surprise gift"]);
    expect(two.rewardDiscountPaise).toBe(0);

    // 5% of 240000 is 12000; the cap makes it 10000.
    const four = await quote(guest, 4);
    expect(four).toMatchObject({ rewardDiscountPaise: 10000, rewardTitle: "5% off your order", discountPaise: 0, totalPaise: 230000 });
    expect(four.earnedGifts).toEqual(["Free surprise gift"]);

    expect(await quote(guest, 4, "RWFLAT50")).toMatchObject({ rewardDiscountPaise: 10000, discountPaise: 5000, totalPaise: 225000 });
    // A percentage coupon works on what is left after the reward: 10% of 230000.
    expect(await quote(guest, 4, "RWTEN")).toMatchObject({ rewardDiscountPaise: 10000, discountPaise: 23000, totalPaise: 207000 });
    await guest.close();
  });

  test("an order keeps the reward apart from the coupon, so coupon figures stay true", async ({ request }) => {
    const res = await buyer.request.post(`${API}/orders`, {
      data: { items: [{ productId: ids["e2e-rw-a"], quantity: 4 }], couponCode: "RWFLAT50", shipping: { name: "Reward Buyer", phone: buyer.phone, line1: "9 Reward Road", city: "Pune", state: "Maharashtra", pincode: "411001" }, paymentMethod: "COD" },
      headers: json,
    });
    expect(res.status(), await res.text()).toBe(201);
    const order = ((await res.json()) as { order: { id: string; discountPaise: number; rewardDiscountPaise: number; totalPaise: number; gifts: string[] } }).order;
    expect(order).toMatchObject({ rewardDiscountPaise: 10000, discountPaise: 15000, totalPaise: 225000, gifts: ["Free surprise gift"] });

    const list = (await (await request.get(`${API}/admin/coupons`, { headers: asBrowser })).json()) as { code: string; discountGivenPaise: number }[];
    expect(list.find((c) => c.code === "RWFLAT50")?.discountGivenPaise).toBe(5000);
    const usage = (await (await request.get(`${API}/admin/coupons/${ids["RWFLAT50"]}/usage`, { headers: asBrowser })).json()) as { discountPaise: number }[];
    expect(usage[0].discountPaise).toBe(5000);

    const page = await buyer.newPage();
    await page.goto("/orders");
    await expect(page.getByText("Order reward").first()).toBeVisible();
    await expect(page.getByText("Free gift with this order: Free surprise gift").first()).toBeVisible();
    await page.close();
  });

  test("the admin sees the reward on the order", async ({ page }) => {
    await page.goto("/admin/orders");
    await page.getByRole("button", { name: /^#/ }).first().click();
    await expect(page.getByText("Order reward").first()).toBeVisible();
    await expect(page.getByText("Pack with this order: Free surprise gift").first()).toBeVisible();
  });

  test("the cart bar celebrates a reward when it is unlocked, not when the page opens with it already earned", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    await putCart(page, 1);
    await page.goto("/cart");
    const bar = page.getByRole("region", { name: "Rewards for your order" });
    await expect(bar).toContainText("more to get Free surprise gift");
    await expect(bar.getByRole("list", { name: "Rewards" }).getByRole("listitem")).toHaveCount(3);
    const confetti = page.locator("body > canvas[aria-hidden='true']");
    await page.waitForTimeout(800);
    await expect(confetti).toHaveCount(0);

    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(bar).toContainText("more to get 5% off your order");
    await expect(confetti).toHaveCount(1);
    await expect(confetti).toHaveCount(0, { timeout: 8000 });

    // Opening the page with the reward already earned stays quiet.
    await page.reload();
    await expect(bar).toContainText("more to get 5% off your order");
    await page.waitForTimeout(1200);
    await expect(confetti).toHaveCount(0);
    await ctx.close();
  });

  test("a product in the cart is removed with a delete icon beside the price", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    await putCart(page, 2);
    await page.goto("/cart");
    await expect(page.getByText("Remove", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Remove E2E e2e-rw-a from your cart" }).click();
    await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
    await ctx.close();
  });

  test("the admin adds a percentage reward next to a gift in settings", async ({ page, request }) => {
    await settings(request, { giftTiers: [] });
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Add a gift" }).click();
    await page.getByLabel("Gift order amount").fill("1500");
    await page.getByLabel("Gift", { exact: true }).fill("Free surprise product");
    await page.getByRole("button", { name: "Add a percentage off" }).click();
    await page.getByLabel("Gift order amount").nth(1).fill("3000");
    await page.getByLabel("Percentage off").fill("10");
    await page.getByLabel("Maximum reward discount").fill("500");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();
    const saved = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as { giftTiers: unknown[] };
    expect(saved.giftTiers).toEqual([
      { atPaise: 150000, title: "Free surprise product" },
      { atPaise: 300000, title: "10% off your order", kind: "PERCENT", percent: 10, maxPaise: 50000 },
    ]);

    // More than 90% is stopped by the form itself, and nothing is saved.
    const percent = page.getByLabel("Percentage off");
    await percent.fill("120");
    await page.getByRole("button", { name: "Save settings" }).click();
    expect(await percent.evaluate((el: HTMLInputElement) => el.validity.rangeOverflow)).toBe(true);
    const after = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as { giftTiers: { percent?: number }[] };
    expect(after.giftTiers[1].percent).toBe(10);
  });
});
