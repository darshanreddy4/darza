import { expect, test, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { adminProduct, asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const shipping = { name: "Return Tester", phone: "9876500000", line1: "1 Return Road", city: "Pune", state: "Maharashtra", pincode: "411001" };
const short = (id: string) => id.slice(-8).toUpperCase();

test.describe.serial("returns", () => {
  let customer: BrowserContext;
  let productId: string;
  let stockBefore: number;
  const orders: string[] = [];

  test.beforeAll(async ({ browser, request }) => {
    const product = await adminProduct(request, "e2e-power-bank");
    productId = product.id;
    stockBefore = product.stock ?? 0;

    customer = await newCustomer(browser, "Return Tester");

    for (let i = 0; i < 2; i++) {
      const res = await customer.request.post(`${API}/orders`, { data: { items: [{ productId, quantity: 1 }], shipping, paymentMethod: "COD" }, headers: asBrowser });
      expect(res.status()).toBe(201);
      orders.push(((await res.json()) as { order: { id: string } }).order.id);
    }
  });

  test.afterAll(async () => { await customer.close(); });

  test("nothing can be returned until the order is delivered", async () => {
    const res = await customer.request.post(`${API}/orders/${orders[0]}/return`, { data: { reason: "Changed my mind", upiId: "spec.user@okbank" }, headers: asBrowser });
    expect(res.status()).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("after an order has been delivered");

    const page = await customer.newPage();
    await page.goto("/orders");
    await expect(page.locator("main").getByText(`#${short(orders[0])}`)).toBeVisible();
    await expect(page.getByRole("button", { name: /Return or refund/ })).toHaveCount(0);
    await page.close();
  });

  test("once delivered, the customer can ask for a return", async ({ request }) => {
    for (const id of orders) {
      for (const status of ["SHIPPED", "DELIVERED"]) {
        expect((await request.patch(`${API}/admin/orders/${id}/status`, { data: { status }, headers: asBrowser })).ok()).toBeTruthy();
      }
    }

    const page = await customer.newPage();
    await page.goto("/orders");
    const card = page.getByRole("listitem").filter({ hasText: `#${short(orders[0])}` }).last();
    await card.getByRole("button", { name: /Return or refund/ }).click();
    await card.getByLabel("Why are you returning these?").selectOption("Damaged or defective");
    await card.getByLabel("Details (optional)").fill("The screen cracked in the box");
    await card.getByLabel("UPI ID for your refund").fill("spec.user@okbank");
    await card.getByRole("button", { name: "Send return request" }).click();
    await expect(card.getByText("Return requested")).toBeVisible();
    await expect(card.getByText("Reason: Damaged or defective")).toBeVisible();
    await page.close();

    const again = await customer.request.post(`${API}/orders/${orders[0]}/return`, { data: { reason: "Other" }, headers: asBrowser });
    expect(again.status()).toBe(400);
    expect(JSON.stringify(await again.json())).toContain("already been returned or is being returned");
  });

  test("an unknown reason is refused", async () => {
    const res = await customer.request.post(`${API}/orders/${orders[1]}/return`, { data: { reason: "Because" }, headers: asBrowser });
    expect(res.status()).toBe(400);
  });

  test("the admin approves, then refunds once the item is back", async ({ page, request }) => {
    await page.goto("/admin/returns");
    const row = page.getByRole("article", { name: `Return for order ${short(orders[0])}` });
    await expect(row).toContainText("Return Tester");
    await expect(row).toContainText("The screen cracked in the box");
    await row.getByRole("button", { name: "Approve return" }).click();
    await expect(page.getByText("Return approved")).toBeVisible();

    await page.getByLabel("Filter by status").selectOption("APPROVED");
    const approved = page.getByRole("article", { name: `Return for order ${short(orders[0])}` });
    await expect(approved).toContainText("Approved");
    page.once("dialog", (d) => d.accept());
    await approved.getByRole("button", { name: "Item received, refund" }).click();
    await expect(page.getByText("Refund recorded")).toBeVisible();

    // The refund put the unit back on the shelf: one order is still open.
    expect((await adminProduct(request, "e2e-power-bank")).stock).toBe(stockBefore - 1);
  });

  test("a return can be declined with a reason the customer sees", async ({ page }) => {
    const res = await customer.request.post(`${API}/orders/${orders[1]}/return`, { data: { reason: "Changed my mind", upiId: "spec.user@okbank" }, headers: asBrowser });
    expect(res.status()).toBe(201);

    await page.goto("/admin/returns");
    const row = page.getByRole("article", { name: `Return for order ${short(orders[1])}` });
    await row.getByRole("button", { name: "Decline" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Tell the customer why" })).toBeVisible();

    await row.getByLabel(/Note to the customer/).fill("Opened items cannot be returned for a change of mind");
    await row.getByRole("button", { name: "Decline" }).click();
    await expect(page.getByText("Return declined")).toBeVisible();

    const mine = await customer.newPage();
    await mine.goto("/orders");
    await expect(mine.getByText("Return refunded")).toBeVisible();
    const card = mine.getByRole("listitem").filter({ hasText: `#${short(orders[1])}` }).last();
    await expect(card.getByText("Return declined")).toBeVisible();
    await expect(card.getByText("Note from us: Opened items cannot be returned for a change of mind")).toBeVisible();
    await mine.close();
  });

  test("returns are for admins to manage", async () => {
    const res = await customer.request.get(`${API}/admin/returns`, { headers: asBrowser });
    expect(res.status()).toBe(403);
  });
});
