import { createHmac } from "node:crypto";
import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { API, API_ONLINE, AUTH_FILES, RAZORPAY_SECRET, RAZORPAY_STUB } from "./data";
import { asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

type Settings = Record<string, unknown> & { freeShippingOverPaise: number | null };
type Quote = {
  totalPaise: number;
  cod: { allowed: boolean; reason: string | null };
  advance: { available: boolean; reason: string | null; percent: number; payNowPaise: number; balancePaise: number };
};
type Placed = { order: { id: string; status: string; paymentMethod: string; advancePaise: number; totalPaise: number }; payment: { razorpayOrderId: string; amountPaise: number } | null };

const shipping = { name: "Part Buyer", phone: "9876500088", line1: "88 Advance Road", city: "Pune", state: "Maharashtra", pincode: "411001" };

async function saveSettings(request: APIRequestContext, over: Record<string, unknown>) {
  const s = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Settings;
  return request.put(`${API}/admin/settings`, {
    data: { shippingFeePaise: s.shippingFeePaise, freeShippingOverPaise: s.freeShippingOverPaise ?? 0, gstEnabled: s.gstEnabled, gstin: s.gstin ?? "", legalName: s.legalName ?? "", businessAddress: s.businessAddress ?? "", businessState: s.businessState ?? "", shippingGstPercent: s.shippingGstPercent, invoicePrefix: s.invoicePrefix, ...over },
    headers: asBrowser,
  });
}

const sign = (razorpayOrderId: string, paymentId: string) => createHmac("sha256", RAZORPAY_SECRET).update(`${razorpayOrderId}|${paymentId}`).digest("hex");

test.describe.serial("online-only products and part payment", () => {
  let categoryId = "";
  const ids: Record<string, string> = {};
  let buyer: BrowserContext;
  let payments = 0;

  const product = (name: string, slug: string, over: Record<string, unknown>) => ({
    name, slug, description: "For payment tests.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], sku: slug.toUpperCase(), pricePaise: 50000, stock: 50, ...over,
  });
  const quote = async (request: APIRequestContext, slugs: string[], paymentMethod?: string) =>
    (await (await request.post(`${API}/checkout/quote`, { data: { items: slugs.map((s) => ({ productId: ids[s], quantity: 1 })), paymentMethod }, headers: asBrowser })).json()) as Quote;
  const place = (base: string, slug: string, paymentMethod: string, extra: Record<string, unknown> = {}) =>
    buyer.request.post(`${base}/orders`, { data: { items: [{ productId: ids[slug], quantity: 1 }], shipping, paymentMethod, ...extra }, headers: asBrowser });
  // Places a part-paid sofa order and pays its advance, as the Razorpay checkout would.
  const placeAndPay = async () => {
    const res = await place(API_ONLINE, "sofa", "ADVANCE");
    expect(res.status(), await res.text()).toBe(201);
    const placed = (await res.json()) as Placed;
    payments += 1;
    const paymentId = `pay_e2e_${Date.now()}_${payments}`;
    const verify = await buyer.request.post(`${API_ONLINE}/orders/${placed.order.id}/verify`, {
      data: { razorpay_order_id: placed.payment!.razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: sign(placed.payment!.razorpayOrderId, paymentId) }, headers: asBrowser,
    });
    expect(verify.ok(), await verify.text()).toBeTruthy();
    return { id: placed.order.id, paymentId };
  };
  const mine = async (id: string) => ((await (await buyer.request.get(`${API}/orders`, { headers: asBrowser })).json()) as { id: string; status: string; advancePaise: number; refundedPaise: number }[]).find((o) => o.id === id)!;
  const stubCalls = async (request: APIRequestContext) => (await (await request.get(`${RAZORPAY_STUB}/calls`)).json()) as { method: string; path: string; body: { amount: number } }[];

  test.beforeAll(async ({ browser, request }) => {
    categoryId = ((await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[])[0].id;
    expect((await saveSettings(request, { advanceEnabled: true })).ok()).toBeTruthy();
    for (const [key, name, over] of [
      ["sofa", "E2E Adv Sofa", { pricePaise: 3000000, advancePercent: 30 }],
      ["bed", "E2E Adv Bed", { pricePaise: 2000000, advancePercent: 40 }],
      ["lamp", "E2E Adv Lamp", { pricePaise: 50000 }],
      ["safe", "E2E Adv Safe", { pricePaise: 1500000, onlineOnly: true }],
    ] as const) {
      const res = await request.post(`${API}/admin/products`, { headers: asBrowser, data: product(name, `e2e-adv-${key}`, over) });
      expect(res.ok(), await res.text()).toBeTruthy();
      ids[key] = ((await res.json()) as { id: string }).id;
    }
    buyer = await newCustomer(browser, "Part Buyer");
  });

  test.afterAll(async ({ request }) => {
    await buyer.close();
    for (const [key, name, over] of [
      ["sofa", "E2E Adv Sofa", { pricePaise: 3000000 }], ["bed", "E2E Adv Bed", { pricePaise: 2000000 }], ["lamp", "E2E Adv Lamp", { pricePaise: 50000 }], ["safe", "E2E Adv Safe", { pricePaise: 1500000 }],
    ] as const) {
      await request.put(`${API}/admin/products/${ids[key]}`, { headers: asBrowser, data: product(name, `e2e-adv-${key}`, { ...over, status: "DRAFT" }) });
    }
    await saveSettings(request, { advanceEnabled: false });
  });

  test("a product can be marked online only: cash is refused for it, alone or in a basket", async ({ request, page }) => {
    const alone = await quote(request, ["safe"], "COD");
    expect(alone.cod.allowed).toBe(false);
    expect(alone.cod.reason).toBe("E2E Adv Safe can only be paid for online.");
    expect((await quote(request, ["safe", "lamp"], "COD")).cod.allowed).toBe(false);
    expect((await quote(request, ["lamp"], "COD")).cod.allowed).toBe(true);
    const refused = await place(API, "safe", "COD");
    expect(refused.status()).toBe(400);
    expect(await refused.text()).toContain("can only be paid for online");
    expect((await place(API, "lamp", "COD")).status()).toBe(201);

    const pub = (await (await request.get(`${API}/products/e2e-adv-safe`)).json()) as { onlineOnly: boolean; advancePercent: number | null };
    expect(pub).toMatchObject({ onlineOnly: true, advancePercent: null });
    await page.goto("/products/e2e-adv-safe");
    await expect(page.getByText("Online payment only").first()).toBeVisible();
  });

  test("part payment: the product page says so while the store offers it, and not when it is switched off", async ({ request, page }) => {
    expect(((await (await request.get(`${API}/products/e2e-adv-sofa`)).json()) as { advancePercent: number | null }).advancePercent).toBe(30);
    expect(((await (await request.get(`${API}/products/e2e-adv-lamp`)).json()) as { advancePercent: number | null }).advancePercent).toBeNull();
    await page.goto("/products/e2e-adv-sofa");
    await expect(page.getByText("Pay 30% now, rest on delivery").first()).toBeVisible();

    expect((await saveSettings(request, { advanceEnabled: false })).ok()).toBeTruthy();
    expect(((await (await request.get(`${API}/products/e2e-adv-sofa`)).json()) as { advancePercent: number | null }).advancePercent).toBeNull();
    const off = await quote(request, ["sofa"], "COD");
    expect(off.advance.available).toBe(false);
    expect(off.advance.reason).toContain("isn't offered");
    // With the switch off, the sofa is an ordinary product again.
    expect(off.cod.allowed).toBe(true);
    expect((await saveSettings(request, { advanceEnabled: true })).ok()).toBeTruthy();
  });

  test("the quote offers part payment at the highest share asked for, only when every product allows it", async ({ request }) => {
    const sofa = await quote(request, ["sofa"]);
    expect(sofa.advance).toEqual({ available: true, reason: null, percent: 30, payNowPaise: 900000, balancePaise: 2100000 });
    const both = await quote(request, ["sofa", "bed"]);
    expect(both.totalPaise).toBe(5000000);
    expect(both.advance).toMatchObject({ available: true, percent: 40, payNowPaise: 2000000, balancePaise: 3000000 });
    const mixed = await quote(request, ["sofa", "lamp"]);
    expect(mixed.advance.available).toBe(false);
    expect(mixed.advance.reason).toContain("E2E Adv Lamp");
    expect((await quote(request, ["sofa", "safe"])).advance.available).toBe(false);
    // The product asks for part payment, so cash alone is not one of its choices.
    const cash = await quote(request, ["sofa"], "COD");
    expect(cash.cod.allowed).toBe(false);
    expect(cash.cod.reason).toContain("needs part of the payment online first");
    expect((await place(API, "sofa", "COD")).status()).toBe(400);
  });

  test("without online payments set up a part-paid order cannot be placed", async () => {
    const res = await place(API, "sofa", "ADVANCE");
    expect(res.status()).toBe(503);
  });

  test("a part-paid order charges only the advance online, and the rest is left for delivery", async ({ request }) => {
    await request.delete(`${RAZORPAY_STUB}/calls`);
    const res = await place(API_ONLINE, "sofa", "ADVANCE");
    expect(res.status(), await res.text()).toBe(201);
    const placed = (await res.json()) as Placed;
    expect(placed.order).toMatchObject({ status: "PENDING_PAYMENT", paymentMethod: "ONLINE", advancePaise: 900000, totalPaise: 3000000 });
    expect(placed.payment!.amountPaise).toBe(900000);
    expect((await stubCalls(request)).find((c) => c.path === "/orders")?.body.amount).toBe(900000);

    const paymentId = "pay_e2e_first";
    const verify = await buyer.request.post(`${API_ONLINE}/orders/${placed.order.id}/verify`, {
      data: { razorpay_order_id: placed.payment!.razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: sign(placed.payment!.razorpayOrderId, paymentId) }, headers: asBrowser,
    });
    expect(verify.ok(), await verify.text()).toBeTruthy();
    expect(await mine(placed.order.id)).toMatchObject({ status: "PAID", advancePaise: 900000 });

    const admin = (await (await request.get(`${API}/admin/orders`, { headers: asBrowser })).json()) as { id: string; advancePaise: number; totalPaise: number }[];
    expect(admin.find((o) => o.id === placed.order.id)).toMatchObject({ advancePaise: 900000, totalPaise: 3000000 });
  });

  test("a wrong share or an unavailable product is refused", async () => {
    // Lamp has no part payment, so it cannot be part-paid.
    const lamp = await place(API_ONLINE, "lamp", "ADVANCE");
    expect(lamp.status()).toBe(400);
    expect(await lamp.text()).toContain("isn't available for E2E Adv Lamp");
    expect((await place(API_ONLINE, "safe", "ADVANCE")).status()).toBe(400);
    // Paying everything online is still fine for any of them.
    expect((await place(API_ONLINE, "safe", "ONLINE")).status()).toBe(201);
  });

  test("cancelling a paid part-paid order refunds the advance, not the whole price", async ({ request }) => {
    const { id, paymentId } = await placeAndPay();
    await request.delete(`${RAZORPAY_STUB}/calls`);
    const cancel = await buyer.request.post(`${API_ONLINE}/orders/${id}/cancel`, { data: { reason: "Ordered by mistake" }, headers: asBrowser });
    expect(cancel.ok(), await cancel.text()).toBeTruthy();
    const refunds = (await stubCalls(request)).filter((c) => c.path === `/payments/${paymentId}/refund`);
    expect(refunds.map((r) => r.body.amount)).toEqual([900000]);
    expect(await mine(id)).toMatchObject({ status: "CANCELLED", refundedPaise: 900000 });
  });

  test("a return after delivery refunds online what was paid online and pays the rest out by UPI", async ({ request }) => {
    const { id, paymentId } = await placeAndPay();
    for (const status of ["SHIPPED", "DELIVERED"]) expect((await request.patch(`${API}/admin/orders/${id}/status`, { data: { status }, headers: asBrowser })).ok()).toBeTruthy();

    const noUpi = await buyer.request.post(`${API}/orders/${id}/return`, { data: { reason: "Changed my mind" }, headers: asBrowser });
    expect(noUpi.status()).toBe(400);
    expect(await noUpi.text()).toContain("UPI");
    const asked = await buyer.request.post(`${API}/orders/${id}/return`, { data: { reason: "Changed my mind", upiId: "buyer@okbank" }, headers: asBrowser });
    expect(asked.status(), await asked.text()).toBe(201);
    const returnId = ((await asked.json()) as { id: string }).id;

    expect((await request.patch(`${API_ONLINE}/admin/returns/${returnId}`, { data: { action: "approve" }, headers: asBrowser })).ok()).toBeTruthy();
    await request.delete(`${RAZORPAY_STUB}/calls`);
    const refund = await request.patch(`${API_ONLINE}/admin/returns/${returnId}`, { data: { action: "refund" }, headers: asBrowser });
    expect(refund.ok(), await refund.text()).toBeTruthy();
    // Razorpay is only asked for the advance; the rest of the price was paid in cash.
    expect((await stubCalls(request)).filter((c) => c.path === `/payments/${paymentId}/refund`).map((c) => c.body.amount)).toEqual([900000]);

    const list = async () => ((await (await request.get(`${API}/admin/returns`, { headers: asBrowser })).json()) as { id: string; payoutDue: boolean; payoutTotalPaise: number; refundPaise: number; payoutUpi: string; order: { advancePaise: number } }[]).find((r) => r.id === returnId)!;
    expect(await list()).toMatchObject({ payoutDue: true, payoutTotalPaise: 2100000, refundPaise: 3000000, payoutUpi: "buyer@okbank", order: { advancePaise: 900000 } });
    expect((await mine(id)).status).toBe("REFUNDED");

    const paid = await request.patch(`${API}/admin/returns/${returnId}`, { data: { action: "paid", reference: "UTR-E2E-1" }, headers: asBrowser });
    expect(paid.ok(), await paid.text()).toBeTruthy();
    expect(await list()).toMatchObject({ payoutDue: false, payoutTotalPaise: 2100000 });
  });

  test("the admin settings page switches part payment on and off", async ({ page, request }) => {
    await page.goto("/admin/settings");
    const box = page.getByLabel(/^Offer part payment/);
    await expect(box).toBeChecked();
    await box.uncheck();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();
    expect(((await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as { advanceEnabled: boolean }).advanceEnabled).toBe(false);
    await box.check();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();
    expect(((await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as { advanceEnabled: boolean }).advanceEnabled).toBe(true);
  });

  test("the product form sets how customers can pay", async ({ page, request }) => {
    await page.goto(`/admin/products/${ids.sofa}`);
    await expect(page.getByLabel(/^Part payment: some now/)).toBeChecked();
    await expect(page.getByLabel(/^Paid online first/)).toHaveValue("30");
    await page.getByLabel(/^Paid online first/).fill("40");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    expect(((await (await request.get(`${API}/products/e2e-adv-sofa`)).json()) as { advancePercent: number }).advancePercent).toBe(40);

    await page.goto(`/admin/products/${ids.sofa}`);
    await page.getByLabel(/^Online payment only/).check();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    expect(await (await request.get(`${API}/products/e2e-adv-sofa`)).json()).toMatchObject({ onlineOnly: true, advancePercent: null });

    // A share outside 10 to 90 is refused.
    await page.goto(`/admin/products/${ids.sofa}`);
    await page.getByLabel(/^Part payment: some now/).check();
    await page.getByLabel(/^Paid online first/).fill("5");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("The share paid in advance must be a whole number from 10 to 90")).toBeVisible();
    // Both at once is refused by the server.
    const both = await request.put(`${API}/admin/products/${ids.sofa}`, { headers: asBrowser, data: product("E2E Adv Sofa", "e2e-adv-sofa", { pricePaise: 3000000, onlineOnly: true, advancePercent: 30 }) });
    expect(both.status()).toBe(400);
    // Put the sofa back as it was.
    expect((await request.put(`${API}/admin/products/${ids.sofa}`, { headers: asBrowser, data: product("E2E Adv Sofa", "e2e-adv-sofa", { pricePaise: 3000000, advancePercent: 30 }) })).ok()).toBeTruthy();
  });
});
