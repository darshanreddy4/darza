import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES, money } from "./data";
import { asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

type Settings = Record<string, unknown> & { freeShippingOverPaise: number | null };
const shipping = { name: "Cash Buyer", phone: "9876500077", line1: "77 Cash Road", city: "Pune", state: "Maharashtra", pincode: "411001" };

async function saveSettings(request: APIRequestContext, over: Record<string, unknown>) {
  const s = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Settings;
  return request.put(`${API}/admin/settings`, {
    data: { shippingFeePaise: s.shippingFeePaise, freeShippingOverPaise: s.freeShippingOverPaise ?? 0, gstEnabled: s.gstEnabled, gstin: s.gstin ?? "", legalName: s.legalName ?? "", businessAddress: s.businessAddress ?? "", businessState: s.businessState ?? "", shippingGstPercent: s.shippingGstPercent, invoicePrefix: s.invoicePrefix, ...over },
    headers: asBrowser,
  });
}

test.describe.serial("pay on delivery rules", () => {
  let productId = "";
  let buyer: BrowserContext;
  const quote = async (request: APIRequestContext, quantity: number, paymentMethod?: string) =>
    (await (await request.post(`${API}/checkout/quote`, { data: { items: [{ productId, quantity }], paymentMethod }, headers: asBrowser })).json()) as {
      subtotalPaise: number; shippingPaise: number; totalPaise: number; codFeePaise: number; cod: { allowed: boolean; feePaise: number; reason: string | null };
    };
  const order = (quantity: number) => buyer.request.post(`${API}/orders`, { data: { items: [{ productId, quantity }], shipping, paymentMethod: "COD" }, headers: asBrowser });

  test.beforeAll(async ({ browser, request }) => {
    const cats = (await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[];
    const res = await request.post(`${API}/admin/products`, {
      headers: asBrowser,
      data: { name: "E2E Cash Kettle", slug: "e2e-cash-kettle", description: "For pay on delivery tests.", categoryId: cats[0].id, productType: "OWN", status: "PUBLISHED", images: [], sku: "E2E-COD", pricePaise: 100000, stock: 50 },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    productId = ((await res.json()) as { id: string }).id;
    buyer = await newCustomer(browser, "Cash Buyer");
  });

  test.afterAll(async ({ request }) => {
    await buyer.close();
    await saveSettings(request, { codEnabled: true, codFeePaise: 0, codMaxOrderPaise: 0 });
    await request.put(`${API}/admin/products/${productId}`, {
      headers: asBrowser,
      data: { name: "E2E Cash Kettle", slug: "e2e-cash-kettle", description: "For pay on delivery tests.", categoryId: (await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json() as { id: string }[])[0].id, productType: "OWN", status: "DRAFT", images: [], sku: "E2E-COD", pricePaise: 100000, stock: 50 },
    });
  });

  test("by default pay on delivery is open to every order and costs nothing extra", async ({ request }) => {
    const q = await quote(request, 1, "COD");
    expect(q.cod).toEqual({ allowed: true, feePaise: 0, reason: null });
    expect(q.codFeePaise).toBe(0);
    const cfg = (await (await request.get(`${API}/store/config`)).json()) as { cod: Record<string, unknown> };
    expect(cfg.cod).toEqual({ enabled: true, feePaise: 0, maxOrderPaise: null });
  });

  test("a fee is added to the total only when pay on delivery is the way to pay", async ({ request }) => {
    expect((await saveSettings(request, { codFeePaise: 4000 })).ok()).toBeTruthy();
    const none = await quote(request, 1);
    const online = await quote(request, 1, "ONLINE");
    const cod = await quote(request, 1, "COD");
    expect([none.codFeePaise, online.codFeePaise, cod.codFeePaise]).toEqual([0, 0, 4000]);
    expect(cod.totalPaise).toBe(online.totalPaise + 4000);
    expect(cod.cod).toEqual({ allowed: true, feePaise: 4000, reason: null });
    // Delivery on its own is not changed by the fee.
    expect(cod.shippingPaise).toBe(online.shippingPaise);
  });

  test("the order is charged the fee, which the invoice calls part of the delivery charge", async ({ request }) => {
    const base = (await quote(request, 1, "ONLINE")).totalPaise;
    const res = await order(1);
    expect(res.status(), await res.text()).toBe(201);
    const { order: placed } = (await res.json()) as { order: { id: string; totalPaise: number; codFeePaise: number; shippingPaise: number } };
    expect(placed.codFeePaise).toBe(4000);
    expect(placed.totalPaise).toBe(base + 4000);
    const invoice = (await (await buyer.request.get(`${API}/orders/${placed.id}/invoice`, { headers: asBrowser })).json()) as { lines: { description: string; amountPaise: number }[] };
    const last = invoice.lines[invoice.lines.length - 1];
    expect(last.description).toBe("Delivery and cash-on-delivery charge");
    expect(last.amountPaise).toBe(placed.shippingPaise);
  });

  test("an order over the limit must be paid online, and the server refuses it for cash", async ({ request }) => {
    expect((await saveSettings(request, { codMaxOrderPaise: 150000 })).ok()).toBeTruthy();
    const small = await quote(request, 1, "COD");
    expect(small.cod.allowed).toBe(true);
    const big = await quote(request, 2, "COD");
    expect(big.cod.allowed).toBe(false);
    expect(big.cod.reason).toContain("up to ₹1,500");
    // No fee is added to an order that cannot use it.
    expect(big.codFeePaise).toBe(0);
    const refused = await order(2);
    expect(refused.status()).toBe(400);
    expect(await refused.text()).toContain("up to ₹1,500");
    expect((await order(1)).status()).toBe(201);
  });

  test("checkout shows the fee, and blocks cash for a big order", async () => {
    const page = await buyer.newPage();
    const cart = (quantity: number) => JSON.stringify([{ productId, slug: "e2e-cash-kettle", name: "E2E Cash Kettle", image: null, pricePaise: 100000, quantity }]);
    await page.goto("/");
    await page.evaluate((v) => localStorage.setItem("dmg-cart", v), cart(1));
    await page.goto("/checkout");
    const cod = page.getByRole("radio", { name: /Pay on delivery/ });
    await expect(cod).toContainText(`A fee of ${money(4000)} is added`);
    await expect(page.getByText("Pay on delivery fee")).toBeVisible();

    await page.evaluate((v) => localStorage.setItem("dmg-cart", v), cart(2));
    await page.goto("/checkout");
    await expect(cod).toBeDisabled();
    await expect(cod).toContainText("up to ₹1,500");
    // Online payments are not set up in the tests, so the order cannot be placed.
    await expect(page.getByRole("alert").filter({ hasText: "cannot be placed" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Place order" })).toBeDisabled();
    await page.evaluate(() => localStorage.removeItem("dmg-cart"));
    await page.close();
  });

  test("pay on delivery can be switched off", async ({ request }) => {
    expect((await saveSettings(request, { codEnabled: false })).ok()).toBeTruthy();
    const q = await quote(request, 1, "COD");
    expect(q.cod.allowed).toBe(false);
    expect(q.cod.reason).toContain("isn't available");
    const refused = await order(1);
    expect(refused.status()).toBe(400);
    expect(await refused.text()).toContain("isn't available");
  });

  test("the admin settings page saves the rules", async ({ page, request }) => {
    await page.goto("/admin/settings");
    await page.getByLabel(/^Offer pay on delivery/).check();
    await page.getByLabel(/^Extra fee for pay on delivery/).fill("25");
    await page.getByLabel(/^Limit the order size/).uncheck();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();
    const s = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as { codEnabled: boolean; codFeePaise: number; codMaxOrderPaise: number | null };
    expect(s).toMatchObject({ codEnabled: true, codFeePaise: 2500, codMaxOrderPaise: null });
    expect((await saveSettings(request, { codFeePaise: -1 })).status()).toBe(400);
  });
});
