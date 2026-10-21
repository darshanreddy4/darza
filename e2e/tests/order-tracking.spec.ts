import { expect, test, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const shipping = { name: "Parcel Buyer", phone: "9876500055", line1: "55 Courier Lane", city: "Pune", state: "Maharashtra", pincode: "411001" };

type OrderRow = { id: string; status: string; courierName: string | null; trackingNumber: string | null; trackingUrl: string | null; shippedAt: string | null };

test.describe.serial("courier and tracking", () => {
  let productId = "";
  let categoryId = "";
  const mug = (over: Record<string, unknown>) => ({ name: "E2E Tracking Mug", slug: "e2e-tracking-mug", description: "For tracking tests.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], sku: "E2E-TRK", pricePaise: 29900, stock: 30, ...over });
  let buyer: BrowserContext;

  const place = async () => {
    const res = await buyer.request.post(`${API}/orders`, { data: { items: [{ productId, quantity: 1 }], shipping, paymentMethod: "COD" }, headers: asBrowser });
    expect(res.status(), await res.text()).toBe(201);
    return ((await res.json()) as { order: { id: string } }).order.id;
  };
  const mine = async (id: string) => ((await (await buyer.request.get(`${API}/orders`, { headers: asBrowser })).json()) as OrderRow[]).find((o) => o.id === id)!;

  test.beforeAll(async ({ browser, request }) => {
    const cats = (await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[];
    categoryId = cats[0].id;
    const res = await request.post(`${API}/admin/products`, { headers: asBrowser, data: mug({}) });
    expect(res.ok(), await res.text()).toBeTruthy();
    productId = ((await res.json()) as { id: string }).id;
    buyer = await newCustomer(browser, "Parcel Buyer");
  });

  test.afterAll(async ({ request }) => {
    await buyer.close();
    await request.put(`${API}/admin/products/${productId}`, { headers: asBrowser, data: mug({ status: "DRAFT" }) });
  });

  test("marking an order shipped with courier details saves them and the customer sees them", async ({ request }) => {
    const id = await place();
    const res = await request.patch(`${API}/admin/orders/${id}/status`, { data: { status: "SHIPPED", courierName: " Blue  Dart ", trackingNumber: "BD 778899", trackingUrl: "https://track.example/BD778899" }, headers: asBrowser });
    expect(res.ok(), await res.text()).toBeTruthy();
    const seen = await mine(id);
    expect(seen).toMatchObject({ status: "SHIPPED", courierName: "Blue Dart", trackingNumber: "BD 778899", trackingUrl: "https://track.example/BD778899" });
    expect(seen.shippedAt).toBeTruthy();
  });

  test("courier details are optional when shipping", async ({ request }) => {
    const id = await place();
    expect((await request.patch(`${API}/admin/orders/${id}/status`, { data: { status: "SHIPPED" }, headers: asBrowser })).ok()).toBeTruthy();
    expect(await mine(id)).toMatchObject({ status: "SHIPPED", courierName: null, trackingNumber: null });
  });

  test("bad details are refused: no courier, an insecure link, or details on another status", async ({ request }) => {
    const id = await place();
    const status = (data: Record<string, unknown>) => request.patch(`${API}/admin/orders/${id}/status`, { data, headers: asBrowser });
    const noCourier = await status({ status: "SHIPPED", trackingNumber: "X1" });
    expect(noCourier.status()).toBe(400);
    expect(await noCourier.text()).toContain("courier");
    expect((await status({ status: "SHIPPED", courierName: "X", trackingUrl: "http://insecure.example/t" })).status()).toBe(400);
    expect((await status({ status: "SHIPPED", courierName: "X", trackingUrl: "javascript:alert(1)" })).status()).toBe(400);
    const wrongStatus = await status({ status: "PAID", courierName: "X" });
    expect(wrongStatus.status()).toBe(400);
    expect(await wrongStatus.text()).toContain("Shipped");
    // Nothing was changed by the refused requests.
    expect((await mine(id)).status).toBe("PLACED");
  });

  test("details can be corrected after shipping, but only once the order has shipped", async ({ request }) => {
    const id = await place();
    const early = await request.patch(`${API}/admin/orders/${id}/tracking`, { data: { courierName: "DTDC" }, headers: asBrowser });
    expect(early.status()).toBe(400);
    expect((await request.patch(`${API}/admin/orders/${id}/status`, { data: { status: "SHIPPED", courierName: "DTDC", trackingNumber: "D1" }, headers: asBrowser })).ok()).toBeTruthy();
    const fixed = await request.patch(`${API}/admin/orders/${id}/tracking`, { data: { courierName: "DTDC", trackingNumber: "D2", trackingUrl: "https://dtdc.example/D2" }, headers: asBrowser });
    expect(fixed.ok(), await fixed.text()).toBeTruthy();
    expect(await mine(id)).toMatchObject({ trackingNumber: "D2", trackingUrl: "https://dtdc.example/D2" });
    // Emptying the fields clears them.
    expect((await request.patch(`${API}/admin/orders/${id}/tracking`, { data: {}, headers: asBrowser })).ok()).toBeTruthy();
    expect(await mine(id)).toMatchObject({ courierName: null, trackingNumber: null, trackingUrl: null });
  });

  test("the admin screen asks for the details when shipping and lets them be edited afterwards", async ({ page, request }) => {
    const id = await place();
    await page.goto("/admin/orders");
    await page.getByRole("button", { name: `#${id.slice(-8).toUpperCase()}` }).click();
    await page.getByLabel(`Status for order ${id.slice(-8)}`).click();
    await page.locator('[role="option"][data-value="SHIPPED"]').click();
    // Nothing is shipped until the panel is confirmed.
    expect((await mine(id)).status).toBe("PLACED");
    await page.getByRole("button", { name: "Self delivery" }).click();
    await expect(page.getByLabel("Courier")).toHaveValue("Self delivery");
    await page.getByLabel("Tracking number").fill("MY-1");
    await page.getByRole("button", { name: "Mark as shipped" }).click();
    await expect(page.getByText("Order marked as shipped")).toBeVisible();
    expect(await mine(id)).toMatchObject({ status: "SHIPPED", courierName: "Self delivery", trackingNumber: "MY-1" });

    await page.getByLabel("Tracking number").fill("MY-2");
    await page.getByRole("button", { name: "Save tracking" }).click();
    await expect(page.getByText("Tracking saved")).toBeVisible();
    expect((await mine(id)).trackingNumber).toBe("MY-2");

    // The audit log records who set it.
    const log = (await (await request.get(`${API}/admin/audit-log`, { headers: asBrowser })).json()) as { items: { action: string }[] };
    expect(log.items.some((e) => e.action === "order.tracking")).toBeTruthy();
  });
});
