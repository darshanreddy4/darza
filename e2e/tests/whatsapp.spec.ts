import { expect, test } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { adminProduct, asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const shipping = { name: "Wa Buyer", phone: "9876500010", line1: "10 Chat Road", city: "Pune", state: "Maharashtra", pincode: "411001" };

test.describe("WhatsApp order updates", () => {
  test("the option is offered at checkout and only recorded when ticked", async ({ browser, request }) => {
    expect((await (await request.get(`${API}/store/config`)).json()).whatsappUpdates).toBe(true);

    const shopper = await newCustomer(browser, "Wa Buyer");
    const product = await adminProduct(request, "e2e-power-bank");
    const place = async (whatsappUpdates?: boolean) => {
      const res = await shopper.request.post(`${API}/orders`, { data: { items: [{ productId: product.id, quantity: 1 }], shipping, paymentMethod: "COD", whatsappUpdates }, headers: asBrowser });
      expect(res.status()).toBe(201);
      return ((await res.json()) as { order: { id: string } }).order.id;
    };
    const yes = await place(true);
    const no = await place();

    const orders = (await (await request.get(`${API}/admin/orders`, { headers: asBrowser })).json()) as { id: string; whatsappOptIn: boolean }[];
    expect(orders.find((o) => o.id === yes)?.whatsappOptIn).toBe(true);
    expect(orders.find((o) => o.id === no)?.whatsappOptIn).toBe(false);

    const page = await shopper.newPage();
    await page.goto("/products/e2e-power-bank");
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await page.goto("/checkout");
    const box = page.getByLabel(/Send my order updates on WhatsApp/);
    await expect(box).not.toBeChecked();
    await box.check();
    await expect(box).toBeChecked();
    await shopper.close();
  });

  test("the admin sees which orders agreed to WhatsApp", async ({ page, request }) => {
    const orders = (await (await request.get(`${API}/admin/orders`, { headers: asBrowser })).json()) as { id: string; whatsappOptIn: boolean }[];
    const withOptIn = orders.find((o) => o.whatsappOptIn)!;
    await page.goto("/admin/orders");
    await page.getByRole("button", { name: `#${withOptIn.id.slice(-8).toUpperCase()}` }).click();
    await expect(page.getByText("WhatsApp updates on for 9876500010")).toBeVisible();
  });
});
