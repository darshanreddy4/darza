import { expect, test } from "@playwright/test";
import { API, AUTH_FILES, CUSTOMER, WEB } from "./data";
import { adminProduct, asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

interface Row { name: string; email: string | null; phone: string | null; itemCount: number; remindedAt: string | null }

test.describe.serial("abandoned carts", () => {
  test("a left-behind cart is noticed and a reminder is sent once", async ({ browser, request }) => {
    const shopper = await browser.newContext({ storageState: AUTH_FILES.customer, baseURL: WEB });
    const page = await shopper.newPage();
    await page.goto("/products/e2e-power-bank");
    await page.getByRole("button", { name: "Add to Cart" }).click();

    const find = async () => ((await (await request.get(`${API}/admin/abandoned-carts`, { headers: asBrowser })).json()) as Row[]).find((r) => r.email === CUSTOMER.email);
    await expect.poll(async () => (await find())?.remindedAt ? "reminded" : (await find()) ? "waiting" : "none", { timeout: 20_000 }).toBe("reminded");
    expect((await find())!.itemCount).toBeGreaterThanOrEqual(1);
    await shopper.close();

    const admin = await browser.newContext({ storageState: AUTH_FILES.admin, baseURL: WEB });
    const view = await admin.newPage();
    await view.goto("/admin/abandoned-carts");
    const row = view.getByRole("row", { name: new RegExp(CUSTOMER.email) });
    await expect(row).toContainText(/Sent/);
    await admin.close();
  });

  test("turning reminders off removes the cart and is remembered", async ({ browser }) => {
    const shopper = await browser.newContext({ storageState: AUTH_FILES.customer, baseURL: WEB });
    const page = await shopper.newPage();
    await page.goto("/account");
    const box = page.getByLabel(/Remind me about items left in my cart/);
    await expect(box).toBeChecked();
    await box.uncheck();
    await expect.poll(async () => (await (await shopper.request.get(`${API}/me/email-preferences`)).json()).cartReminders).toBe(false);
    await page.reload();
    await expect(page.getByLabel(/Remind me about items left in my cart/)).not.toBeChecked();

    await page.getByLabel(/Remind me about items left in my cart/).check();
    await expect.poll(async () => (await (await shopper.request.get(`${API}/me/email-preferences`)).json()).cartReminders).toBe(true);
    await shopper.close();
  });

  test("buying clears the saved cart", async ({ browser, request }) => {
    const shopper = await newCustomer(browser, "Cart Buyer");
    const page = await shopper.newPage();
    await page.goto("/products/e2e-power-bank");
    await page.getByRole("button", { name: "Add to Cart" }).click();

    const mine = async () => ((await (await request.get(`${API}/admin/abandoned-carts`, { headers: asBrowser })).json()) as Row[]).find((r) => r.name === "Cart Buyer");
    await expect.poll(async () => !!(await mine()), { timeout: 15_000 }).toBe(true);
    expect((await mine())!.remindedAt).toBeNull(); // no email address to write to

    const product = await adminProduct(request, "e2e-power-bank");
    const order = await shopper.request.post(`${API}/orders`, { data: { items: [{ productId: product.id, quantity: 1 }], shipping: { name: "Cart Buyer", phone: "9876500001", line1: "1 Cart Road", city: "Pune", state: "Maharashtra", pincode: "411001" }, paymentMethod: "COD" }, headers: asBrowser });
    expect(order.status()).toBe(201);
    await expect.poll(async () => !!(await mine())).toBe(false);
    await shopper.close();
  });

  test("the unsubscribe link needs a genuine token", async ({ browser, request }) => {
    const res = await request.post(`${API}/unsubscribe`, { data: { token: "bm90LWEtdXNlcg.forged" }, headers: asBrowser });
    expect(res.status()).toBe(400);

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL: WEB });
    const page = await visitor.newPage();
    await page.goto("/unsubscribe");
    await expect(page.locator("main").getByRole("alert")).toContainText("not valid");
    await page.goto("/unsubscribe?token=bm90LWEtdXNlcg.forged");
    await page.getByRole("button", { name: "Stop cart reminders" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("not valid");
    await visitor.close();
  });
});
