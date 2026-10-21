import { expect, test, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

type Settings = Record<string, unknown> & { freeShippingOverPaise: number | null };
const shipping = { name: "Tax Buyer", phone: "9876500066", line1: "66 GST Road", city: "Pune", state: "Maharashtra", pincode: "411001" };

async function saveSettings(request: import("@playwright/test").APIRequestContext, over: Record<string, unknown>) {
  const s = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Settings;
  return request.put(`${API}/admin/settings`, {
    data: { shippingFeePaise: s.shippingFeePaise, freeShippingOverPaise: s.freeShippingOverPaise ?? 0, gstEnabled: s.gstEnabled, gstin: s.gstin ?? "", legalName: s.legalName ?? "", businessAddress: s.businessAddress ?? "", businessState: s.businessState ?? "", shippingGstPercent: s.shippingGstPercent, invoicePrefix: s.invoicePrefix, ...over },
    headers: asBrowser,
  });
}

test.describe.serial("HSN code on products and invoices", () => {
  let categoryId = "";
  let productId = "";
  let orderId = "";
  let buyer: BrowserContext;
  let before: Settings;

  const item = (over: Record<string, unknown>) => ({ name: "E2E HSN Charger", slug: "e2e-hsn-charger", description: "For HSN tests.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], sku: "E2E-HSN", pricePaise: 118000, stock: 20, gstRatePercent: 18, ...over });

  test.beforeAll(async ({ browser, request }) => {
    before = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Settings;
    const cats = (await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[];
    categoryId = cats[0].id;
    const on = await saveSettings(request, { gstEnabled: true, gstin: "27AAPFU0939F1ZV", legalName: "E2E Traders", businessAddress: "1 Test Road, Pune", businessState: "Maharashtra" });
    expect(on.ok(), await on.text()).toBeTruthy();
    buyer = await newCustomer(browser, "Tax Buyer");
  });

  test.afterAll(async ({ request }) => {
    await buyer.close();
    await request.put(`${API}/admin/products/${productId}`, { headers: asBrowser, data: item({ status: "DRAFT" }) });
    await saveSettings(request, { gstEnabled: before.gstEnabled, gstin: before.gstin ?? "", legalName: before.legalName ?? "", businessAddress: before.businessAddress ?? "", businessState: before.businessState ?? "" });
  });

  test("the code must be 4, 6 or 8 digits", async ({ request }) => {
    for (const bad of ["12", "85044", "ABCD", "8504 40"]) {
      const res = await request.post(`${API}/admin/products`, { headers: asBrowser, data: item({ slug: "e2e-hsn-bad", sku: "E2E-HSN-BAD", hsnCode: bad }) });
      expect(res.status(), bad).toBe(400);
    }
    const ok = await request.post(`${API}/admin/products`, { headers: asBrowser, data: item({ hsnCode: "850440" }) });
    expect(ok.ok(), await ok.text()).toBeTruthy();
    const made = (await ok.json()) as { id: string; hsnCode: string };
    productId = made.id;
    expect(made.hsnCode).toBe("850440");
  });

  test("the invoice prints the code beside the product, and keeps it if the product changes later", async ({ request }) => {
    const res = await buyer.request.post(`${API}/orders`, { data: { items: [{ productId, quantity: 1 }], shipping, paymentMethod: "COD" }, headers: asBrowser });
    expect(res.status(), await res.text()).toBe(201);
    orderId = ((await res.json()) as { order: { id: string } }).order.id;

    const invoice = async () => (await (await buyer.request.get(`${API}/orders/${orderId}/invoice`, { headers: asBrowser })).json()) as { lines: { description: string; hsnCode: string | null }[] };
    expect((await invoice()).lines[0]).toMatchObject({ description: "E2E HSN Charger", hsnCode: "850440" });

    expect((await request.put(`${API}/admin/products/${productId}`, { headers: asBrowser, data: item({ hsnCode: "999999" }) })).ok()).toBeTruthy();
    expect((await invoice()).lines[0].hsnCode).toBe("850440");
  });

  test("the invoice page shows it", async () => {
    const page = await buyer.newPage();
    await page.goto(`/invoice/${orderId}`);
    await expect(page.getByText("HSN 850440")).toBeVisible();
    await page.close();
  });

  test("the admin form saves and checks the code", async ({ page, request }) => {
    await page.goto(`/admin/products/${productId}`);
    await expect(page.getByLabel(/^HSN \/ SAC code/)).toHaveValue("999999");
    await page.getByLabel(/^HSN \/ SAC code/).fill("12");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("The HSN code must be 4, 6 or 8 digits")).toBeVisible();
    await page.getByLabel(/^HSN \/ SAC code/).fill("8504 40 90");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    const saved = (await (await request.get(`${API}/admin/products/${productId}`, { headers: asBrowser })).json()) as { hsnCode: string };
    expect(saved.hsnCode).toBe("85044090");
  });

  test("the spreadsheet export carries the code", async ({ request }) => {
    const csv = await (await request.get(`${API}/admin/products/export`, { headers: asBrowser })).text();
    const [header, ...rows] = csv.replace(/^\uFEFF/, "").split("\n");
    expect(header.split(",")).toContain("hsn");
    expect(rows.find((r) => r.startsWith("e2e-hsn-charger,"))).toContain("85044090");
  });
});
