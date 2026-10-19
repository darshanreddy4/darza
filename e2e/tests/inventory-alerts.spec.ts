import { expect, test, type APIRequestContext } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser, expectOptions } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

type Settings = Record<string, unknown> & { freeShippingOverPaise: number | null };

// The settings form sends every field, so changes start from what is saved.
async function saveSettings(request: APIRequestContext, over: Record<string, unknown>) {
  const s = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Settings;
  const body = {
    shippingFeePaise: s.shippingFeePaise, freeShippingOverPaise: s.freeShippingOverPaise ?? 0, gstEnabled: s.gstEnabled, gstin: s.gstin ?? "", legalName: s.legalName ?? "",
    businessAddress: s.businessAddress ?? "", businessState: s.businessState ?? "", shippingGstPercent: s.shippingGstPercent, invoicePrefix: s.invoicePrefix, ...over,
  };
  const res = await request.put(`${API}/admin/settings`, { data: body, headers: asBrowser });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()) as Settings;
}

test.describe.serial("inventory alerts", () => {
  let productId = "";
  let categoryId = "";
  const dto = (stock: number) => ({
    name: "E2E Alert Lamp", slug: "e2e-inventory-lamp", description: "Used to test low stock emails.", categoryId, productType: "OWN",
    status: "PUBLISHED", pricePaise: 99900, sku: "E2E-INV-LAMP", stock, images: [{ url: "https://picsum.photos/seed/e2e/200/200" }],
  });

  test.beforeAll(async ({ request }) => {
    const cats = (await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[];
    categoryId = cats[0].id;
    const created = await request.post(`${API}/admin/products`, { data: dto(20), headers: asBrowser });
    expect(created.ok(), await created.text()).toBeTruthy();
    productId = (await created.json()).id;
  });

  test.afterAll(async ({ request }) => {
    await request.delete(`${API}/admin/products/${productId}`, { headers: asBrowser });
    await saveSettings(request, { lowStockThreshold: 5, alertEmail: "" });
  });

  test("the low stock level and alert address are set in Settings", async ({ page, request }) => {
    await page.goto("/admin/settings");
    await page.getByLabel(/Low stock level/).fill("3");
    await page.getByLabel(/Email the alerts to/).fill("stock@dmg.test");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();

    const saved = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Settings;
    expect(saved).toMatchObject({ lowStockThreshold: 3, alertEmail: "stock@dmg.test" });

    await page.goto("/admin/products");
    await expectOptions(page.getByLabel("Filter by stock"), { present: ["Low stock (1–3)"] });
  });

  test("a bad alert address is refused", async ({ request }) => {
    const s = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Settings;
    const res = await request.put(`${API}/admin/settings`, {
      data: { shippingFeePaise: s.shippingFeePaise, freeShippingOverPaise: 0, gstEnabled: false, shippingGstPercent: 18, invoicePrefix: s.invoicePrefix, alertEmail: "not-an-email" }, headers: asBrowser,
    });
    expect(res.status()).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("valid email address");
  });

  test("a product dropping to the level is alerted once, and again only after it recovers", async ({ request }) => {
    const alerted = async () => (await (await request.get(`${API}/admin/products/${productId}`, { headers: asBrowser })).json()).lowStockAlertedAt as string | null;
    expect(await alerted()).toBeNull();

    expect((await request.put(`${API}/admin/products/${productId}`, { data: dto(2), headers: asBrowser })).ok()).toBeTruthy();
    await expect.poll(alerted, { timeout: 20_000 }).not.toBeNull();
    const first = await alerted();
    await new Promise((r) => setTimeout(r, 4500));
    expect(await alerted()).toBe(first);

    expect((await request.put(`${API}/admin/products/${productId}`, { data: dto(20), headers: asBrowser })).ok()).toBeTruthy();
    await expect.poll(alerted, { timeout: 20_000 }).toBeNull();
  });

  test("the low stock list follows the chosen level", async ({ page, request }) => {
    expect((await request.put(`${API}/admin/products/${productId}`, { data: dto(3), headers: asBrowser })).ok()).toBeTruthy();
    await page.goto("/admin/attention");
    await expect(page.getByText("Our own products with 3 or fewer in stock.")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "E2E Alert Lamp" })).toContainText("Only 3 left");
  });
});
