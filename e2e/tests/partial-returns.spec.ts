import { pick } from "./helpers";
import { expect, test, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES, money } from "./data";
import { adminProduct, asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const shipping = { name: "Part Returner", phone: "9876500005", line1: "5 Return Road", city: "Pune", state: "Maharashtra", pincode: "411001" };
const short = (id: string) => id.slice(-8).toUpperCase();

test.describe.serial("returning only some of an order", () => {
  let customer: BrowserContext;
  let orderId = "";
  let bankId = "";
  let cableId = "";
  let bankStock = 0;
  let cableStock = 0;

  test.beforeAll(async ({ browser, request }) => {
    const bank = await adminProduct(request, "e2e-power-bank");
    const cable = await adminProduct(request, "e2e-usb-cable");
    bankId = bank.id; cableId = cable.id;
    customer = await newCustomer(browser, "Part Returner");
    const res = await customer.request.post(`${API}/orders`, { data: { items: [{ productId: bankId, quantity: 2 }, { productId: cableId, quantity: 1 }], shipping, paymentMethod: "COD" }, headers: asBrowser });
    expect(res.status()).toBe(201);
    orderId = ((await res.json()) as { order: { id: string } }).order.id;
    for (const status of ["SHIPPED", "DELIVERED"]) expect((await request.patch(`${API}/admin/orders/${orderId}/status`, { data: { status }, headers: asBrowser })).ok()).toBeTruthy();
    bankStock = (await adminProduct(request, "e2e-power-bank")).stock ?? 0;
    cableStock = (await adminProduct(request, "e2e-usb-cable")).stock ?? 0;
  });
  test.afterAll(async () => { await customer.close(); });

  test("the customer picks one of the two power banks and nothing else", async () => {
    const page = await customer.newPage();
    await page.goto("/orders");
    const card = page.getByRole("listitem").filter({ hasText: `#${short(orderId)}` }).last();
    await card.getByRole("button", { name: /Return or refund/ }).click();
    await card.getByLabel("E2E USB-C Cable").uncheck();
    await pick(card.getByLabel("Quantity"), "1");
    await pick(card.getByLabel("Why are you returning these?"), "Size or fit issue");
    await card.getByLabel("UPI ID for your refund").fill("spec.user@okbank");
    await card.getByRole("button", { name: "Send return request" }).click();
    await expect(card.getByText("Return requested")).toBeVisible();
    await expect(card.getByText("1 × E2E Power Bank")).toBeVisible();
    await page.close();
  });

  test("more than is left, or nothing at all, is refused", async () => {
    const lines = ((await (await customer.request.get(`${API}/orders`)).json()) as { id: string; items: { id: string; product: { name: string } }[] }[]).find((o) => o.id === orderId)!.items;
    const bankLine = lines.find((l) => l.product.name.includes("Power Bank"))!.id;
    const tooMany = await customer.request.post(`${API}/orders/${orderId}/return`, { data: { reason: "Other", upiId: "spec.user@okbank", items: [{ orderItemId: bankLine, quantity: 2 }] }, headers: asBrowser });
    expect(tooMany.status()).toBe(400);
    expect(JSON.stringify(await tooMany.json())).toContain("more than you have left");
    const foreign = await customer.request.post(`${API}/orders/${orderId}/return`, { data: { reason: "Other", upiId: "spec.user@okbank", items: [{ orderItemId: "not-an-item", quantity: 1 }] }, headers: asBrowser });
    expect(foreign.status()).toBe(400);
  });

  test("the admin refunds just that item's value and it goes back on the shelf", async ({ page, request }) => {
    await page.goto("/admin/returns");
    const row = page.getByRole("article", { name: `Return for order ${short(orderId)}` });
    await expect(row).toContainText("Power Bank 10000mAh × 1");
    await expect(row).toContainText(`refund would be ${money(149900)}`);
    await row.getByRole("button", { name: "Approve return" }).click();
    await expect(page.getByText("Return approved")).toBeVisible();
    await pick(page.getByLabel("Filter by status"), "APPROVED");
    const approved = page.getByRole("article", { name: `Return for order ${short(orderId)}` });
    page.once("dialog", (d) => { expect(d.message()).toContain(money(149900)); void d.accept(); });
    await approved.getByRole("button", { name: "Item received, refund" }).click();
    await expect(page.getByText("Refund recorded")).toBeVisible();

    expect((await adminProduct(request, "e2e-power-bank")).stock).toBe(bankStock + 1);
    expect((await adminProduct(request, "e2e-usb-cable")).stock).toBe(cableStock);
    const orders = (await (await customer.request.get(`${API}/orders`)).json()) as { id: string; status: string }[];
    expect(orders.find((o) => o.id === orderId)!.status).toBe("DELIVERED");
  });

  test("the customer sees the refund and can return what is left", async () => {
    const page = await customer.newPage();
    await page.goto("/orders");
    const card = page.getByRole("listitem").filter({ hasText: `#${short(orderId)}` }).last();
    await expect(card.getByText(`Return refunded · ${money(149900)} refunded`)).toBeVisible();
    await card.getByRole("button", { name: /Return more items/ }).click();
    await expect(card.getByLabel("E2E USB-C Cable")).toBeVisible();
    await expect(card.getByLabel("Quantity")).toHaveCount(0);
    await pick(card.getByLabel("Why are you returning these?"), "Changed my mind");
    await card.getByLabel("UPI ID for your refund").fill("spec.user@okbank");
    await card.getByRole("button", { name: "Send return request" }).click();
    await expect(card.getByText("Return requested")).toBeVisible();
    await page.close();
  });

  test("the last return refunds the rest and closes the order", async ({ page, request }) => {
    await page.goto("/admin/returns");
    const row = page.getByRole("article", { name: `Return for order ${short(orderId)}` });
    await expect(row).toContainText(`refund would be ${money(179800)}`);
    await row.getByRole("button", { name: "Approve return" }).click();
    await pick(page.getByLabel("Filter by status"), "APPROVED");
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("article", { name: `Return for order ${short(orderId)}` }).getByRole("button", { name: "Item received, refund" }).click();
    await expect(page.getByText("Refund recorded")).toBeVisible();

    const orders = (await (await customer.request.get(`${API}/orders`)).json()) as { id: string; status: string }[];
    expect(orders.find((o) => o.id === orderId)!.status).toBe("REFUNDED");
    expect((await adminProduct(request, "e2e-power-bank")).stock).toBe(bankStock + 2);
    expect((await adminProduct(request, "e2e-usb-cable")).stock).toBe(cableStock + 1);
  });
});
