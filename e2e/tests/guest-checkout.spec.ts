import { createHmac } from "node:crypto";
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { API, API_ONLINE, AUTH_FILES, RAZORPAY_SECRET } from "./data";
import { asBrowser, knownLinkToken, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

type Settings = Record<string, unknown> & { freeShippingOverPaise: number | null };
interface Quote {
  totalPaise: number;
  cod: { allowed: boolean; reason: string | null };
  guest: { isGuest: boolean; deliveryAdvance: { allowed: boolean; reason: string | null; advancePaise: number; balancePaise: number; totalPaise: number } | null };
}
interface Placed { order: { id: string; status: string; paymentMethod: string; advancePaise: number; totalPaise: number; codFeePaise: number; shippingPaise: number }; payment: { razorpayOrderId: string; amountPaise: number } | null }

const shipping = { name: "Gita Guest", phone: "9876500080", line1: "80 Guest Road", city: "Pune", state: "Maharashtra", pincode: "411001" };
const newPhone = (n = 0) => `97${String(Date.now() + n).slice(-8)}`;
const sign = (razorpayOrderId: string, paymentId: string) => createHmac("sha256", RAZORPAY_SECRET).update(`${razorpayOrderId}|${paymentId}`).digest("hex");

async function saveSettings(request: APIRequestContext, over: Record<string, unknown>) {
  const s = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Settings;
  const res = await request.put(`${API}/admin/settings`, {
    data: { shippingFeePaise: s.shippingFeePaise, freeShippingOverPaise: s.freeShippingOverPaise ?? 0, gstEnabled: s.gstEnabled, gstin: s.gstin ?? "", legalName: s.legalName ?? "", businessAddress: s.businessAddress ?? "", businessState: s.businessState ?? "", shippingGstPercent: s.shippingGstPercent, invoicePrefix: s.invoicePrefix, ...over },
    headers: asBrowser,
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

// A guest session: a name and a code sent to a mobile number, nothing else.
async function guestSession(browser: Browser, name = "Gita Guest") {
  const context = await browser.newContext({ baseURL: process.env.E2E_WEB_URL ?? "http://localhost:3100", storageState: { cookies: [], origins: [] } });
  const phone = newPhone(Math.floor(Math.random() * 1000));
  const sent = await context.request.post(`${API}/auth/otp/send`, { data: { phone, purpose: "guest" }, headers: asBrowser });
  expect(sent.status(), await sent.text()).toBe(201);
  const { devCode } = (await sent.json()) as { devCode: string };
  const done = await context.request.post(`${API}/auth/otp/verify`, { data: { phone, purpose: "guest", code: devCode, name, termsAccepted: true }, headers: asBrowser });
  expect(done.ok(), await done.text()).toBeTruthy();
  return Object.assign(context, { phone });
}

test.describe.serial("guest checkout", () => {
  let categoryId = "";
  let kettleId = "";
  let safeId = "";
  let before: Settings;
  let guest: BrowserContext & { phone: string };

  const product = (over: Record<string, unknown>) => ({ name: "E2E Guest Kettle", slug: "e2e-guest-kettle", description: "For guest checkout tests.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], sku: "E2E-GUEST-KETTLE", pricePaise: 100000, stock: 60, ...over });
  const quote = async (ctx: BrowserContext, paymentMethod?: string, items = [{ productId: kettleId, quantity: 1 }]) =>
    (await (await ctx.request.post(`${API}/checkout/quote`, { data: { items, paymentMethod }, headers: asBrowser })).json()) as Quote;
  const place = (ctx: BrowserContext, base: string, paymentMethod: string, items = [{ productId: kettleId, quantity: 1 }]) =>
    ctx.request.post(`${base}/orders`, { data: { items, shipping, paymentMethod }, headers: asBrowser });

  test.beforeAll(async ({ request }) => {
    before = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Settings;
    categoryId = ((await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[])[0].id;
    const made = await request.post(`${API}/admin/products`, { headers: asBrowser, data: product({}) });
    expect(made.ok(), await made.text()).toBeTruthy();
    kettleId = ((await made.json()) as { id: string }).id;
    const safe = await request.post(`${API}/admin/products`, { headers: asBrowser, data: product({ name: "E2E Guest Safe", slug: "e2e-guest-safe", sku: "E2E-GUEST-SAFE", pricePaise: 200000, onlineOnly: true }) });
    expect(safe.ok(), await safe.text()).toBeTruthy();
    safeId = ((await safe.json()) as { id: string }).id;
  });

  test.afterAll(async ({ request }) => {
    await saveSettings(request, { shippingFeePaise: before.shippingFeePaise, freeShippingOverPaise: before.freeShippingOverPaise ?? 0, codEnabled: true, codFeePaise: 0, codMaxOrderPaise: 0, guestCheckoutEnabled: false, guestCodEnabled: true, guestMinAdvancePaise: 5000 });
    await request.put(`${API}/admin/products/${kettleId}`, { headers: asBrowser, data: product({ status: "DRAFT" }) });
    await request.put(`${API}/admin/products/${safeId}`, { headers: asBrowser, data: product({ name: "E2E Guest Safe", slug: "e2e-guest-safe", sku: "E2E-GUEST-SAFE", pricePaise: 200000, onlineOnly: true, status: "DRAFT" }) });
    await guest?.close();
  });

  test("it is off until an admin switches it on", async ({ request }) => {
    const sent = await request.post(`${API}/auth/otp/send`, { data: { phone: newPhone(), purpose: "guest" }, headers: asBrowser });
    expect(sent.status()).toBe(400);
    expect(JSON.stringify(await sent.json())).toContain("isn't available");
    expect(((await (await request.get(`${API}/store/config`)).json()) as { guest: { checkoutEnabled: boolean } }).guest.checkoutEnabled).toBe(false);
  });

  test("an admin turns it on in Settings", async ({ page, request }) => {
    await saveSettings(request, { shippingFeePaise: 6000, freeShippingOverPaise: 0, codEnabled: true, codFeePaise: 4000, codMaxOrderPaise: 0, advanceEnabled: false });
    await page.goto("/admin/settings");
    const box = page.getByLabel(/Allow guest checkout/);
    await expect(box).not.toBeChecked();
    await box.check();
    await expect(page.getByLabel(/Let guests pay the delivery charge now/)).toBeChecked();
    await page.getByLabel(/Least a guest pays online/).fill("50");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();
    expect(((await (await request.get(`${API}/store/config`)).json()) as { guest: { checkoutEnabled: boolean; codEnabled: boolean; minAdvancePaise: number } }).guest).toEqual({ checkoutEnabled: true, codEnabled: true, minAdvancePaise: 5000 });
  });

  test("a guest gives a name, accepts the terms and confirms the number with a code", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: process.env.E2E_WEB_URL ?? "http://localhost:3100", storageState: { cookies: [], origins: [] } });
    const phone = newPhone(7);
    const sent = await context.request.post(`${API}/auth/otp/send`, { data: { phone, purpose: "guest" }, headers: asBrowser });
    const { devCode } = (await sent.json()) as { devCode: string };
    const verify = (body: Record<string, unknown>) => context.request.post(`${API}/auth/otp/verify`, { data: { phone, purpose: "guest", code: devCode, ...body }, headers: asBrowser });
    expect((await verify({ termsAccepted: true })).status()).toBe(400);
    // A refused attempt used the code up, so ask again.
    const again = (await (await context.request.post(`${API}/auth/otp/send`, { data: { phone, purpose: "guest" }, headers: asBrowser })).json()) as { devCode?: string };
    expect(again.devCode ?? "").toMatch(/^\d{6}$|^$/);
    await context.close();

    guest = await guestSession(browser);
    const me = (await (await guest.request.get(`${API}/auth/me`, { headers: asBrowser })).json()) as { user: { guestCheckout: boolean; verified: boolean; role: string } };
    expect(me.user).toMatchObject({ guestCheckout: true, verified: true, role: "CUSTOMER" });
  });

  test("a guest is quoted online payment, or the delivery charge now and the rest on delivery", async () => {
    const online = await quote(guest, "ONLINE");
    expect(online.guest.isGuest).toBe(true);
    expect(online.cod.allowed).toBe(false);
    expect(online.cod.reason).toContain("Guests pay online");
    expect(online.totalPaise).toBe(106000);

    const split = await quote(guest, "DELIVERY_ADVANCE");
    // Delivery 60 plus the pay-on-delivery fee 40 now; the goods are paid in cash.
    expect(split.guest.deliveryAdvance).toEqual({ allowed: true, reason: null, advancePaise: 10000, balancePaise: 100000, totalPaise: 110000 });
    expect(split.totalPaise).toBe(110000);
  });

  test("a guest cannot pay on delivery in full", async () => {
    const res = await place(guest, API_ONLINE, "COD");
    expect(res.status()).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("Guests pay online");
  });

  test("a guest pays everything online before the order ships", async () => {
    const res = await place(guest, API_ONLINE, "ONLINE");
    expect(res.status(), await res.text()).toBe(201);
    const placed = (await res.json()) as Placed;
    expect(placed.order).toMatchObject({ status: "PENDING_PAYMENT", paymentMethod: "ONLINE", advancePaise: 0, totalPaise: 106000 });
    expect(placed.payment!.amountPaise).toBe(106000);
  });

  test("a guest pays the delivery charge online and the rest in cash, and the courier is told how much to collect", async ({ request }) => {
    const res = await place(guest, API_ONLINE, "DELIVERY_ADVANCE");
    expect(res.status(), await res.text()).toBe(201);
    const placed = (await res.json()) as Placed;
    expect(placed.order).toMatchObject({ status: "PENDING_PAYMENT", paymentMethod: "ONLINE", advancePaise: 10000, totalPaise: 110000, codFeePaise: 4000 });
    expect(placed.payment!.amountPaise).toBe(10000);

    const paymentId = `pay_guest_${Date.now()}`;
    const paid = await guest.request.post(`${API_ONLINE}/orders/${placed.order.id}/verify`, { data: { razorpay_order_id: placed.payment!.razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: sign(placed.payment!.razorpayOrderId, paymentId) }, headers: asBrowser });
    expect(paid.ok(), await paid.text()).toBeTruthy();

    const label = ((await (await request.get(`${API}/admin/orders/labels?ids=${placed.order.id}`, { headers: asBrowser })).json()) as { orders: { status: string; collectPaise: number }[] }).orders[0];
    expect(label).toMatchObject({ status: "PAID", collectPaise: 100000 });

    const listed = ((await (await request.get(`${API}/admin/orders`, { headers: asBrowser })).json()) as { id: string; user: { guestCheckout: boolean } }[]).find((o) => o.id === placed.order.id)!;
    expect(listed.user.guestCheckout).toBe(true);
  });

  test("products that must be paid online refuse the cash part", async () => {
    const items = [{ productId: safeId, quantity: 1 }];
    const q = await quote(guest, "DELIVERY_ADVANCE", items);
    expect(q.guest.deliveryAdvance!.allowed).toBe(false);
    expect(q.guest.deliveryAdvance!.reason).toContain("can only be paid for online");
    const res = await place(guest, API_ONLINE, "DELIVERY_ADVANCE", items);
    expect(res.status()).toBe(400);
    expect((await place(guest, API_ONLINE, "ONLINE", items)).status()).toBe(201);
  });

  test("the cash part can be switched off, and then guests pay online only", async ({ request }) => {
    await saveSettings(request, { guestCodEnabled: false });
    const q = await quote(guest, "DELIVERY_ADVANCE");
    expect(q.guest.deliveryAdvance).toMatchObject({ allowed: false });
    expect(q.guest.deliveryAdvance!.reason).toContain("isn't offered to guests");
    const res = await place(guest, API_ONLINE, "DELIVERY_ADVANCE");
    expect(res.status()).toBe(400);
    await saveSettings(request, { guestCodEnabled: true });
  });

  test("this way to pay is for guests only, and everyone else keeps pay on delivery", async ({ browser }) => {
    const regular = await newCustomer(browser, "Regular Buyer");
    const refused = await place(regular, API_ONLINE, "DELIVERY_ADVANCE");
    expect(refused.status()).toBe(400);
    expect(JSON.stringify(await refused.json())).toContain("only for checking out without an account");
    expect((await quote(regular, "COD")).cod.allowed).toBe(true);
    const cod = await place(regular, API, "COD");
    expect(cod.status(), await cod.text()).toBe(201);
    await regular.close();
  });

  test("confirming an email address ends guest status, and pay on delivery opens up", async ({ browser }) => {
    const member = await guestSession(browser, "Soon Member");
    expect((await quote(member, "COD")).cod.allowed).toBe(false);
    const email = `guest-${Date.now()}@dmg.test`;
    expect((await member.request.post(`${API}/auth/email`, { data: { email }, headers: asBrowser })).ok()).toBeTruthy();
    const confirmed = await member.request.post(`${API}/auth/verify-email`, { data: { token: await knownLinkToken("EMAIL_ADD", email) }, headers: asBrowser });
    expect(confirmed.ok(), await confirmed.text()).toBeTruthy();
    expect((await quote(member, "COD")).cod.allowed).toBe(true);
    const me = (await (await member.request.get(`${API}/auth/me`, { headers: asBrowser })).json()) as { user: { guestCheckout: boolean } };
    expect(me.user.guestCheckout).toBe(false);
    await member.close();
  });

  test("on the checkout page a shopper without an account is offered the mobile number, not a login wall", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: process.env.E2E_WEB_URL ?? "http://localhost:3100", storageState: { cookies: [], origins: [] } });
    const page: Page = await context.newPage();
    await page.goto("/products/e2e-guest-kettle");
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await page.getByRole("link", { name: "Go to cart" }).click();
    await page.getByRole("link", { name: /checkout/i }).first().click();
    await page.getByRole("link", { name: "Continue as a guest" }).click();
    await expect(page.getByRole("heading", { name: "Continue with your mobile number" })).toBeVisible();

    await page.getByPlaceholder("98765 43210").fill(newPhone(11));
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("form", { name: "Mobile number" }).getByRole("alert")).toContainText("name");
    await page.getByLabel("Your name").fill("Gita Guest");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("form", { name: "Mobile number" }).getByRole("alert")).toContainText("accept the Terms");
    await page.getByLabel(/I agree to the/).check();
    const [sent] = await Promise.all([page.waitForResponse((r) => r.url().includes("/auth/otp/send")), page.getByRole("button", { name: "Send code" }).click()]);
    const { devCode } = (await sent.json()) as { devCode: string };
    await page.getByPlaceholder("••••••").fill(devCode);

    await expect(page.getByText(/You are checking out as a guest/)).toBeVisible();
    await expect(page.getByRole("radio", { name: /^Pay on delivery/ })).toHaveCount(0);
    // This test server has no online payments, so a guest has no way to pay and is told so.
    await expect(page.getByText(/Online payment is not available right now/)).toBeVisible();
    await context.close();
  });
});
