import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

type Settings = Record<string, unknown> & { freeShippingOverPaise: number | null };
const shipping = { name: "Sku Buyer", phone: "9876500060", line1: "60 Sku Road", city: "Pune", state: "Maharashtra", pincode: "411001" };

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

interface Option { id: string; label: string; sku: string | null; weightGrams: number | null; stock: number; lowStockAlertedAt: string | null }

test.describe.serial("option SKUs, weights and option stock alerts", () => {
  let categoryId = "";
  let teeId = "";
  let otherId = "";
  let buyer: BrowserContext;
  let optionIds: Record<string, string> = {};

  const tee = (over: Record<string, unknown> = {}) => ({
    name: "E2E Sku Tee", slug: "e2e-sku-tee", description: "Sold in sizes.", categoryId, productType: "OWN", status: "PUBLISHED", images: [{ url: "https://picsum.photos/seed/e2e/200/200" }], sku: "E2E-SKU-TEE", pricePaise: 1, stock: 0, optionNames: ["Size"],
    options: [
      { id: optionIds.L, values: ["L"], pricePaise: 70000, stock: 3, sku: "E2E-TEE-L", weightGrams: 250 },
      { id: optionIds.XL, values: ["XL"], pricePaise: 70000, stock: 40, sku: "E2E-TEE-XL", weightGrams: 300 },
    ],
    ...over,
  });
  const other = (over: Record<string, unknown> = {}) => ({ name: "E2E Sku Other", slug: "e2e-sku-other", description: "Has a SKU of its own.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], sku: "E2E-SKU-OTHER", pricePaise: 10000, stock: 10, ...over });
  const product = async (request: APIRequestContext) => (await (await request.get(`${API}/admin/products/${teeId}`, { headers: asBrowser })).json()) as { lowStockAlertedAt: string | null; options: Option[] };
  const optionOf = async (request: APIRequestContext, label: string) => (await product(request)).options.find((o) => o.label === label)!;

  test.beforeAll(async ({ browser, request }) => {
    categoryId = ((await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[])[0].id;
    const made = await request.post(`${API}/admin/products`, { headers: asBrowser, data: tee() });
    expect(made.ok(), await made.text()).toBeTruthy();
    const body = (await made.json()) as { id: string; options: Option[] };
    teeId = body.id;
    optionIds = Object.fromEntries(body.options.map((o) => [o.label, o.id]));
    const madeOther = await request.post(`${API}/admin/products`, { headers: asBrowser, data: other() });
    expect(madeOther.ok(), await madeOther.text()).toBeTruthy();
    otherId = ((await madeOther.json()) as { id: string }).id;
    buyer = await newCustomer(browser, "Sku Buyer");
    await saveSettings(request, { lowStockThreshold: 5, alertEmail: "stock@dmg.test" });
  });

  test.afterAll(async ({ request }) => {
    await request.put(`${API}/admin/products/${teeId}`, { headers: asBrowser, data: tee({ status: "DRAFT" }) });
    await request.put(`${API}/admin/products/${otherId}`, { headers: asBrowser, data: other({ status: "DRAFT" }) });
    await saveSettings(request, { lowStockThreshold: 5, alertEmail: "", skuWeightEnabled: false, optionStockAlerts: false });
    await buyer?.close();
  });

  test("each option keeps its own SKU and weight", async ({ request }) => {
    const l = await optionOf(request, "L");
    expect([l.sku, l.weightGrams]).toEqual(["E2E-TEE-L", 250]);
    const xl = await optionOf(request, "XL");
    expect([xl.sku, xl.weightGrams]).toEqual(["E2E-TEE-XL", 300]);
  });

  test("an option SKU must be new, well formed and not repeated", async ({ request }) => {
    const put = (options: Record<string, unknown>[], extra: Record<string, unknown> = {}) => request.put(`${API}/admin/products/${teeId}`, { headers: asBrowser, data: tee({ options, ...extra }) });
    const keep = { id: optionIds.XL, values: ["XL"], pricePaise: 70000, stock: 40, sku: "E2E-TEE-XL", weightGrams: 300 };
    const l = (over: Record<string, unknown>) => ({ id: optionIds.L, values: ["L"], pricePaise: 70000, stock: 3, ...over });

    const twice = await put([l({ sku: "SAME-1" }), { ...keep, sku: "same-1" }]);
    expect(twice.status()).toBe(400);
    expect(JSON.stringify(await twice.json())).toContain("used on two options");
    const taken = await put([l({ sku: "E2E-SKU-OTHER" }), keep]);
    expect(taken.status()).toBe(400);
    expect(JSON.stringify(await taken.json())).toContain("already used");
    const own = await put([l({ sku: "E2E-SKU-TEE" }), keep]);
    expect(own.status()).toBe(400);
    expect(JSON.stringify(await own.json())).toContain("same as the product's SKU");
    expect((await put([l({ sku: "bad sku" }), keep])).status()).toBe(400);
    expect((await put([l({ sku: "OK-1", weightGrams: 0 }), keep])).status()).toBe(400);
    // Another product cannot take an option's SKU either.
    expect((await request.put(`${API}/admin/products/${otherId}`, { headers: asBrowser, data: other({ sku: "E2E-TEE-L" }) })).status()).toBeGreaterThanOrEqual(400);
    expect((await optionOf(request, "L")).sku).toBe("E2E-TEE-L");
  });

  test("a packing slip shows the SKU of the exact option bought and the parcel weight, kept as bought", async ({ request }) => {
    const res = await buyer.request.post(`${API}/orders`, { data: { items: [{ productId: teeId, optionId: optionIds.L, quantity: 2 }], shipping, paymentMethod: "COD" }, headers: asBrowser });
    expect(res.status(), await res.text()).toBe(201);
    const id = ((await res.json()) as { order: { id: string } }).order.id;

    const labels = async () => ((await (await request.get(`${API}/admin/orders/labels?ids=${id}`, { headers: asBrowser })).json()) as { orders: { totalWeightGrams: number | null; items: { sku: string | null; weightGrams: number | null }[] }[] }).orders[0];
    expect(await labels()).toMatchObject({ totalWeightGrams: 500, items: [{ sku: "E2E-TEE-L", weightGrams: 250 }] });

    // Changing the option afterwards does not rewrite what was bought.
    const renamed = await request.put(`${API}/admin/products/${teeId}`, { headers: asBrowser, data: tee({ options: [{ id: optionIds.L, values: ["L"], pricePaise: 70000, stock: 1, sku: "E2E-TEE-L2", weightGrams: 260 }, { id: optionIds.XL, values: ["XL"], pricePaise: 70000, stock: 40, sku: "E2E-TEE-XL", weightGrams: 300 }] }) });
    expect(renamed.ok(), await renamed.text()).toBeTruthy();
    expect(await labels()).toMatchObject({ totalWeightGrams: 500, items: [{ sku: "E2E-TEE-L", weightGrams: 250 }] });
  });

  test("the SKU and weight fields on the product page follow a switch in Settings", async ({ page }) => {
    const saved = async (checked: boolean) => {
      await page.goto("/admin/settings");
      const box = page.getByLabel(/Record weight and a SKU for each option/);
      if (checked) await box.check(); else await box.uncheck();
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(page.getByText("Settings saved")).toBeVisible();
    };
    await saved(false);
    await page.goto(`/admin/products/${teeId}`);
    await expect(page.getByLabel("Option 1 price")).toBeVisible();
    await expect(page.getByLabel("Option 1 SKU")).toHaveCount(0);

    await saved(true);
    await page.goto(`/admin/products/${teeId}`);
    await expect(page.getByLabel("Option 1 SKU")).toHaveValue("E2E-TEE-L2");
    await expect(page.getByLabel("Option 1 weight")).toHaveValue("260");
    await expect(page.getByLabel("Option 2 SKU")).toHaveValue("E2E-TEE-XL");
  });

  test("a spreadsheet carries option SKUs and weights both ways", async ({ request }) => {
    const exported = await (await request.get(`${API}/admin/products/export`, { headers: asBrowser })).text();
    expect(exported).toContain("E2E-TEE-L2 ; 260");
    expect(exported).toContain("weight_g");

    const csv = `slug,options\ne2e-sku-tee,L ; 700 ; ; 1 ; ; E2E-TEE-L2 ; 275 | XL ; 700 ; ; 40 ; ; E2E-TEE-XL ; 300\n`;
    const res = await request.post(`${API}/admin/products/import`, { data: csv, headers: { ...asBrowser, "content-type": "text/csv" } });
    expect(res.ok(), await res.text()).toBeTruthy();
    expect(await optionOf(request, "L")).toMatchObject({ sku: "E2E-TEE-L2", weightGrams: 275 });
  });

  test("with option alerts off a low option is not flagged; switched on it is, once, and again only after it recovers", async ({ request }) => {
    // The first test of this file left size L at 1 unit, below the level of 5, while the product has 41.
    await saveSettings(request, { optionStockAlerts: false });
    expect((await optionOf(request, "L")).stock).toBe(1);
    await new Promise((r) => setTimeout(r, 4500));
    expect((await optionOf(request, "L")).lowStockAlertedAt).toBeNull();

    await saveSettings(request, { optionStockAlerts: true });
    await expect.poll(async () => (await optionOf(request, "L")).lowStockAlertedAt, { timeout: 20_000 }).not.toBeNull();
    const first = (await optionOf(request, "L")).lowStockAlertedAt;
    // The product as a whole has plenty, and the healthy option is left alone.
    expect((await product(request)).lowStockAlertedAt).toBeNull();
    expect((await optionOf(request, "XL")).lowStockAlertedAt).toBeNull();
    await new Promise((r) => setTimeout(r, 4500));
    expect((await optionOf(request, "L")).lowStockAlertedAt).toBe(first);

    const restock = await request.put(`${API}/admin/products/${teeId}`, { headers: asBrowser, data: tee({ options: [{ id: optionIds.L, values: ["L"], pricePaise: 70000, stock: 20, sku: "E2E-TEE-L2", weightGrams: 275 }, { id: optionIds.XL, values: ["XL"], pricePaise: 70000, stock: 40, sku: "E2E-TEE-XL", weightGrams: 300 }] }) });
    expect(restock.ok(), await restock.text()).toBeTruthy();
    await expect.poll(async () => (await optionOf(request, "L")).lowStockAlertedAt, { timeout: 20_000 }).toBeNull();
  });

  test("the Attention list shows a low option only while the switch is on", async ({ page, request }) => {
    const lowAgain = await request.put(`${API}/admin/products/${teeId}`, { headers: asBrowser, data: tee({ options: [{ id: optionIds.L, values: ["L"], pricePaise: 70000, stock: 2, sku: "E2E-TEE-L2", weightGrams: 275 }, { id: optionIds.XL, values: ["XL"], pricePaise: 70000, stock: 40, sku: "E2E-TEE-XL", weightGrams: 300 }] }) });
    expect(lowAgain.ok()).toBeTruthy();

    await page.goto("/admin/attention");
    await expect(page.getByText(/or any one of their options, with 5 or fewer in stock/)).toBeVisible();
    const row = page.getByRole("listitem").filter({ hasText: "E2E Sku Tee" });
    await expect(row.first()).toContainText("L: 2 left");

    await saveSettings(request, { optionStockAlerts: false });
    await page.goto("/admin/attention");
    await expect(page.getByText("Our own products with 5 or fewer in stock.")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "E2E Sku Tee" })).toHaveCount(0);
  });
});
