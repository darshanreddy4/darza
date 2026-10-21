import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

type Settings = Record<string, unknown> & { freeShippingOverPaise: number | null };
const shipping = { name: "Progress Buyer", phone: "9876500070", line1: "70 Progress Road", city: "Pune", state: "Maharashtra", pincode: "411001" };

// The settings form sends every field, so changes start from what is saved.
async function saveSettings(request: APIRequestContext, over: Record<string, unknown>) {
  const s = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Settings;
  const body = {
    shippingFeePaise: s.shippingFeePaise, freeShippingOverPaise: s.freeShippingOverPaise ?? 0, gstEnabled: s.gstEnabled, gstin: s.gstin ?? "", legalName: s.legalName ?? "",
    businessAddress: s.businessAddress ?? "", businessState: s.businessState ?? "", shippingGstPercent: s.shippingGstPercent, invoicePrefix: s.invoicePrefix, ...over,
  };
  const res = await request.put(`${API}/admin/settings`, { data: body, headers: asBrowser });
  expect(res.ok(), await res.text()).toBeTruthy();
}

test.describe.serial("order progress bar", () => {
  let categoryId = "";
  let productId = "";
  let buyer: BrowserContext;
  let delivered = "";
  let cancelled = "";

  const mug = (over: Record<string, unknown> = {}) => ({ name: "E2E Progress Mug", slug: "e2e-progress-mug", description: "For progress tests.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], sku: "E2E-PROGRESS", pricePaise: 30000, stock: 30, ...over });
  const place = async () => {
    const res = await buyer.request.post(`${API}/orders`, { data: { items: [{ productId, quantity: 1 }], shipping, paymentMethod: "COD" }, headers: asBrowser });
    expect(res.status(), await res.text()).toBe(201);
    return ((await res.json()) as { order: { id: string } }).order.id;
  };
  const setStatus = (request: APIRequestContext, id: string, body: Record<string, unknown>) => request.patch(`${API}/admin/orders/${id}/status`, { data: body, headers: asBrowser });
  const bar = (page: import("@playwright/test").Page) => page.getByTestId("order-progress");
  const barOf = (page: import("@playwright/test").Page, id: string) => page.locator("li").filter({ hasText: `#${id.slice(-8).toUpperCase()}` }).getByTestId("order-progress").first();

  test.beforeAll(async ({ browser, request }) => {
    categoryId = ((await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[])[0].id;
    const made = await request.post(`${API}/admin/products`, { headers: asBrowser, data: mug() });
    expect(made.ok(), await made.text()).toBeTruthy();
    productId = ((await made.json()) as { id: string }).id;
    buyer = await newCustomer(browser, "Progress Buyer");
    delivered = await place();
    cancelled = await place();
    await saveSettings(request, { orderProgressEnabled: true });
  });

  test.afterAll(async ({ request }) => {
    await request.put(`${API}/admin/products/${productId}`, { headers: asBrowser, data: mug({ status: "DRAFT" }) });
    await saveSettings(request, { orderProgressEnabled: true });
    await buyer?.close();
  });

  test("a new order is on the preparing step", async () => {
    const page = await buyer.newPage();
    await page.goto("/orders");
    const first = barOf(page, delivered);
    await expect(first).toBeVisible();
    await expect(first.locator('[aria-current="step"]')).toContainText("Preparing");
    await expect(first.getByRole("listitem").filter({ hasText: "Order placed" })).toContainText("(done)");
    await expect(first.getByRole("listitem").filter({ hasText: "Shipped" })).toContainText("(not yet)");
    await expect(first).toContainText("being prepared");
    await page.close();
  });

  test("shipping moves it on, with the date and courier", async ({ request }) => {
    expect((await setStatus(request, delivered, { status: "SHIPPED", courierName: "DTDC" })).ok()).toBeTruthy();
    const page = await buyer.newPage();
    await page.goto("/orders");
    const first = barOf(page, delivered);
    await expect(first.locator('[aria-current="step"]')).toContainText("Shipped");
    await expect(first.locator('[aria-current="step"]')).toContainText("DTDC");
    await expect(first.getByRole("listitem").filter({ hasText: "Preparing" })).toContainText("(done)");
    await expect(first).toContainText("on its way");
    await page.close();
  });

  test("delivery completes every step", async ({ request }) => {
    expect((await setStatus(request, delivered, { status: "DELIVERED" })).ok()).toBeTruthy();
    const page = await buyer.newPage();
    await page.goto("/orders");
    const first = barOf(page, delivered);
    await expect(first.locator('[aria-current="step"]')).toHaveCount(0);
    await expect(first.getByText("(done)")).toHaveCount(4);
    await expect(first).toContainText("has been delivered");
    await page.close();
  });

  test("a cancelled order has no bar", async ({ request }) => {
    expect((await setStatus(request, cancelled, { status: "CANCELLED" })).ok()).toBeTruthy();
    const page = await buyer.newPage();
    await page.goto("/orders");
    await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(bar(page)).toHaveCount(1);
    await page.close();
  });

  test("an admin switches the bar off and on in Settings", async ({ page, request }) => {
    await page.goto("/admin/settings");
    const box = page.getByLabel(/Show an order progress bar on My orders/);
    await expect(box).toBeChecked();
    await box.uncheck();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();
    expect(((await (await request.get(`${API}/store/config`)).json()) as { orderProgressEnabled: boolean }).orderProgressEnabled).toBe(false);

    const shopper = await buyer.newPage();
    await shopper.goto("/orders");
    await expect(shopper.getByText("Delivered", { exact: true }).first()).toBeVisible();
    await expect(bar(shopper)).toHaveCount(0);

    await page.goto("/admin/settings");
    await page.getByLabel(/Show an order progress bar on My orders/).check();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();
    await shopper.reload();
    await expect(bar(shopper)).toHaveCount(1);
    await shopper.close();
  });
});
