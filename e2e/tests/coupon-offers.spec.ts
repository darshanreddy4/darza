import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES, WEB } from "./data";
import { asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin, viewport: { width: 1280, height: 900 } });

const json = { ...asBrowser, "content-type": "application/json" };
const signedOut = { cookies: [], origins: [] };
const ids: Record<string, string> = {};

interface Offer { code: string; unlocked: boolean; discountPaise: number; remainingPaise: number; minOrderPaise: number }
interface Quote { offers: Offer[]; couponError: string | null; rewards: { milestones: { kind: string; title: string; atPaise: number; reached: boolean }[]; next: { title: string; remainingPaise: number } | null } }

// Codes a shopper can use are listed in the cart and sit on the progress bar at the amount that unlocks them.
test.describe.serial("coupon offers in the cart", () => {
  let categoryId = "";
  let original: Record<string, unknown>;
  let a: BrowserContext & { phone: string };
  let b: BrowserContext & { phone: string };
  let c: BrowserContext & { phone: string };
  const made: Record<string, Record<string, unknown>> = {};

  const coupon = async (request: APIRequestContext, code: string, over: Record<string, unknown>) => {
    const dto = { code, type: "FLAT", value: 5000, ...over };
    const res = await request.post(`${API}/admin/coupons`, { data: dto, headers: json });
    expect(res.status(), await res.text()).toBe(201);
    made[code] = dto;
    ids[code] = (await res.json()).id;
  };
  const quote = async (ctx: { request: APIRequestContext }, qty: number, couponCode?: string) => {
    const res = await ctx.request.post(`${API}/checkout/quote`, { data: { items: [{ productId: ids["e2e-off-a"], quantity: qty }], couponCode }, headers: json });
    return (await res.json()) as Quote;
  };
  const codes = (q: Quote) => q.offers.map((o) => o.code).filter((x) => x.startsWith("OFF"));
  const place = (ctx: BrowserContext, phone: string, qty: number, couponCode?: string) =>
    ctx.request.post(`${API}/orders`, {
      data: { items: [{ productId: ids["e2e-off-a"], quantity: qty }], couponCode, shipping: { name: "Offer Buyer", phone, line1: "7 Offer Road", city: "Pune", state: "Maharashtra", pincode: "411001" }, paymentMethod: "COD" },
      headers: json,
    });
  const putCart = (page: import("@playwright/test").Page, quantity: number) =>
    page.evaluate(([id, q]) => localStorage.setItem("dmg-cart", JSON.stringify([{ productId: id, slug: "e2e-off-a", name: "E2E e2e-off-a", image: null, pricePaise: 20000, quantity: q }])), [ids["e2e-off-a"], quantity] as const);

  test.beforeAll(async ({ browser, request }) => {
    const cats = (await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[];
    categoryId = cats[0].id;
    original = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Record<string, unknown>;
    const body = (s: Record<string, unknown>, over: Record<string, unknown>) => ({
      shippingFeePaise: s.shippingFeePaise, freeShippingOverPaise: s.freeShippingOverPaise ?? 0, gstEnabled: s.gstEnabled, gstin: s.gstin ?? "", legalName: s.legalName ?? "",
      businessAddress: s.businessAddress ?? "", businessState: s.businessState ?? "", shippingGstPercent: s.shippingGstPercent, invoicePrefix: s.invoicePrefix, ...over,
    });
    const res = await request.put(`${API}/admin/settings`, { data: body(original, { shippingFeePaise: 5000, freeShippingOverPaise: 50000, freeAllOverPaise: 0, deliveryZones: [], giftTiers: [] }), headers: json });
    expect(res.ok(), await res.text()).toBeTruthy();
    const product = await request.post(`${API}/admin/products`, { data: { name: "E2E e2e-off-a", slug: "e2e-off-a", sku: "E2E-OFF-A", description: "Used to test offers.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], stock: 80, pricePaise: 20000 }, headers: asBrowser });
    expect(product.ok(), await product.text()).toBeTruthy();
    ids["e2e-off-a"] = (await product.json()).id;
    a = await newCustomer(browser, "Offer A");
    b = await newCustomer(browser, "Offer B");
    c = await newCustomer(browser, "Offer C");
    await coupon(request, "OFFMIN300", { value: 5000, minOrderPaise: 30000, perUserLimit: 1 });
    await coupon(request, "OFFBIG", { type: "PERCENT", value: 10, minOrderPaise: 90000, maxDiscountPaise: 20000 });
    await coupon(request, "OFFHIDDEN", { value: 1000, visible: false });
    await coupon(request, "OFFVIP", { value: 2000, minOrderPaise: 10000, customers: a.phone });
    await coupon(request, "OFFFIRST", { type: "PERCENT", value: 10, firstOrderOnly: true });
  });

  test.afterAll(async ({ request }) => {
    await Promise.all([a, b, c].map((x) => x?.close()));
    const s = original;
    await request.put(`${API}/admin/settings`, {
      data: {
        shippingFeePaise: s.shippingFeePaise, freeShippingOverPaise: s.freeShippingOverPaise ?? 0, gstEnabled: s.gstEnabled, gstin: s.gstin ?? "", legalName: s.legalName ?? "",
        businessAddress: s.businessAddress ?? "", businessState: s.businessState ?? "", shippingGstPercent: s.shippingGstPercent, invoicePrefix: s.invoicePrefix,
        freeAllOverPaise: s.freeAllOverPaise ?? 0, deliveryZones: s.deliveryZones, giftTiers: s.giftTiers,
      },
      headers: json,
    });
    for (const [code, dto] of Object.entries(made)) {
      const res = await request.delete(`${API}/admin/coupons/${ids[code]}`, { headers: asBrowser });
      if (!res.ok()) await request.put(`${API}/admin/coupons/${ids[code]}`, { data: { ...dto, active: false }, headers: json });
    }
    await request.put(`${API}/admin/products/${ids["e2e-off-a"]}`, { data: { name: "E2E e2e-off-a", slug: "e2e-off-a", sku: "E2E-OFF-A", description: "x", categoryId, productType: "OWN", status: "DRAFT", images: [], stock: 80, pricePaise: 1000 }, headers: asBrowser });
  });

  test("a shopper is told which codes they can use, and which unlock with a bit more spend", async ({ browser }) => {
    const guest = await browser.newContext({ storageState: signedOut });
    const one = await quote(guest, 1);
    // The hidden code and the private code are not listed to a guest; first-order codes are.
    expect(codes(one)).toEqual(["OFFFIRST", "OFFMIN300", "OFFBIG"]);
    expect(one.offers.find((o) => o.code === "OFFMIN300")).toMatchObject({ unlocked: false, remainingPaise: 10000, minOrderPaise: 30000 });
    expect(one.offers.find((o) => o.code === "OFFBIG")).toMatchObject({ unlocked: false, remainingPaise: 70000 });
    expect(one.offers.find((o) => o.code === "OFFFIRST")).toMatchObject({ unlocked: true, discountPaise: 2000 });

    // They sit on the same bar, at the amount that unlocks them, in order.
    const onBar = one.rewards.milestones.filter((m) => m.kind === "coupon");
    expect(onBar.map((m) => [m.title, m.atPaise, m.reached])).toEqual([["₹50 off with code OFFMIN300", 30000, false], ["10% off (up to ₹200) with code OFFBIG", 90000, false]]);
    expect(one.rewards.next).toEqual({ title: "₹50 off with code OFFMIN300", remainingPaise: 10000 });

    const two = await quote(guest, 2);
    expect(two.offers.find((o) => o.code === "OFFMIN300")).toMatchObject({ unlocked: true, discountPaise: 5000, remainingPaise: 0 });
    expect(two.rewards.milestones.find((m) => m.title.includes("OFFMIN300"))?.reached).toBe(true);
    // A hidden code still works when somebody has been given it.
    expect((await quote(guest, 2, "OFFHIDDEN")).couponError).toBeNull();
    await guest.close();
  });

  test("a code made for chosen customers is listed to them only", async () => {
    expect(codes(await quote(a, 1))).toContain("OFFVIP");
    expect(codes(await quote(b, 1))).not.toContain("OFFVIP");
    expect((await quote(a, 1)).offers.find((o) => o.code === "OFFVIP")).toMatchObject({ unlocked: true, discountPaise: 2000 });
  });

  test("a code the shopper has used, or a first-order code after their first order, is no longer offered", async () => {
    expect(codes(await quote(b, 2))).toEqual(expect.arrayContaining(["OFFFIRST", "OFFMIN300"]));
    const res = await place(b, b.phone, 2, "OFFMIN300");
    expect(res.status(), await res.text()).toBe(201);
    const after = codes(await quote(b, 2));
    expect(after).not.toContain("OFFMIN300");
    expect(after).not.toContain("OFFFIRST");
    // Somebody else still has them.
    expect(codes(await quote(c, 2))).toEqual(expect.arrayContaining(["OFFFIRST", "OFFMIN300"]));
  });

  test("the cart lists the codes, shows them on the bar, and unlocks them as the shopper adds items", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    await putCart(page, 1);
    await page.goto("/cart");
    const bar = page.getByRole("region", { name: "Rewards for your order" });
    const offers = page.getByRole("region", { name: "Offers for you" });
    await expect(bar).toContainText("more to get ₹50 off with code OFFMIN300");
    await expect(bar.getByRole("list", { name: "Rewards" })).toContainText("10% off (up to ₹200) with code OFFBIG");
    // The reward cards slide in a single row.
    const row = await bar.getByRole("list", { name: "Rewards" }).evaluate((el: HTMLElement) => ({ rows: new Set([...el.children].map((c) => (c as HTMLElement).offsetTop)).size, overflow: getComputedStyle(el).overflowX }));
    expect(row).toEqual({ rows: 1, overflow: "auto" });
    await expect(offers).toContainText("OFFMIN300");
    await expect(offers).toContainText("more to use this code");
    await expect(offers.getByRole("button", { name: "Use code OFFMIN300" })).toBeDisabled();
    await expect(offers).not.toContainText("OFFHIDDEN");

    // More than three offers scroll inside their own block instead of making the summary long.
    const list = offers.getByRole("list", { name: "Offers, scrollable" });
    await expect(offers).toContainText("scroll for more");
    const box = await list.evaluate((el: HTMLElement) => ({ visible: el.clientHeight, full: el.scrollHeight, overflow: getComputedStyle(el).overflowY }));
    expect(box.overflow).toBe("auto");
    expect(box.full).toBeGreaterThan(box.visible);
    expect(box.visible).toBeLessThanOrEqual(330);

    const confetti = page.locator("body > canvas[aria-hidden='true']");
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(offers.getByRole("button", { name: "Use code OFFMIN300" })).toBeEnabled();
    await expect(confetti).toHaveCount(1);
    await expect(offers).toContainText("Save ₹50 on this cart");

    await offers.getByRole("button", { name: "Use code OFFMIN300" }).click();
    await expect(page.locator("aside")).toContainText("Discount (OFFMIN300)");
    await expect(offers).toContainText("Applied");
    await ctx.close();
  });

  test("the admin chooses whether a code is shown to customers", async ({ page, request }) => {
    await page.goto("/admin/coupons");
    await page.getByRole("button", { name: "+ New coupon" }).click();
    await page.getByLabel(/^Code/).fill("OFFQUIET");
    await page.getByLabel(/^Percentage/).fill("5");
    await page.getByLabel("Show this code to customers who can use it").uncheck();
    await page.getByRole("button", { name: "Create coupon" }).click();
    await expect(page.getByText("Coupon created")).toBeVisible();
    await expect(page.getByRole("row", { name: /OFFQUIET/ })).toContainText("Hidden: not listed in carts");
    const list = (await (await request.get(`${API}/admin/coupons`, { headers: asBrowser })).json()) as { id: string; code: string; visible: boolean }[];
    const row = list.find((x) => x.code === "OFFQUIET")!;
    expect(row.visible).toBe(false);
    ids["OFFQUIET"] = row.id;
    made["OFFQUIET"] = { type: "PERCENT", value: 5 };

    expect(codes(await quote(c, 1))).not.toContain("OFFQUIET");
    // Switching it on lists it.
    const on = await request.put(`${API}/admin/coupons/${row.id}`, { data: { code: "OFFQUIET", type: "PERCENT", value: 5, visible: true }, headers: json });
    expect(on.ok()).toBeTruthy();
    expect(codes(await quote(c, 1))).toContain("OFFQUIET");
  });

});
