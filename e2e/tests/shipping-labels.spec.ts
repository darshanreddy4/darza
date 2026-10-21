import { expect, test, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const stamp = Date.now();
const shipping = { name: "Label Buyer", phone: "9876500040", line1: "40 Label Road", line2: "Near the park", city: "Pune", state: "Maharashtra", pincode: "411001" };
const ref = (id: string) => id.slice(-8).toUpperCase();

test.describe.serial("shipping labels, packing slips and shipping in bulk", () => {
  const orders: string[] = [];
  let packer: BrowserContext;
  let buyer: BrowserContext;
  let productId = "";
  let categoryId = "";
  const lamp = (over: Record<string, unknown> = {}) => ({ name: "E2E Ship Lamp", slug: "e2e-ship-lamp", description: "For shipping tests.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], sku: "E2E-SHIP", pricePaise: 90000, stock: 30, ...over });

  test.beforeAll(async ({ browser, request }) => {
    buyer = await newCustomer(browser, "Label Buyer");
    packer = await newCustomer(browser, `Pat Packer ${stamp}`);
    categoryId = ((await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[])[0].id;
    const made = await request.post(`${API}/admin/products`, { headers: asBrowser, data: lamp() });
    expect(made.ok(), await made.text()).toBeTruthy();
    productId = ((await made.json()) as { id: string }).id;
    for (let n = 0; n < 3; n++) {
      const res = await buyer.request.post(`${API}/orders`, { data: { items: [{ productId, quantity: n + 1 }], shipping, paymentMethod: "COD" }, headers: asBrowser });
      expect(res.status(), await res.text()).toBe(201);
      orders.push(((await res.json()) as { order: { id: string } }).order.id);
    }
    // The third one has gone already.
    expect((await request.patch(`${API}/admin/orders/${orders[2]}/status`, { data: { status: "SHIPPED" }, headers: asBrowser })).ok()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    await request.put(`${API}/admin/products/${productId}`, { headers: asBrowser, data: lamp({ status: "DRAFT" }) });
    await buyer.close();
    await packer.close();
  });

  test("labels carry the address, the cash to collect and the sender, in the order asked for", async ({ request }) => {
    const res = await request.get(`${API}/admin/orders/labels?ids=${orders[1]},${orders[0]},nosuchorder123,bad`, { headers: asBrowser });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { seller: { name: string }; orders: { id: string; collectPaise: number; totalPaise: number; shippingAddr: { pincode: string }; items: { name: string; quantity: number }[] }[] };
    expect(body.seller.name.length).toBeGreaterThan(0);
    expect(body.orders.map((o) => o.id)).toEqual([orders[1], orders[0]]);
    for (const o of body.orders) {
      expect(o.collectPaise).toBe(o.totalPaise);
      expect(o.shippingAddr.pincode).toBe("411001");
      expect(o.items[0].name).toContain("Ship Lamp");
    }
    expect(body.orders[1].items[0].quantity).toBe(1);
    expect(JSON.stringify(body)).not.toContain("costPaise");
  });

  test("customers cannot print labels, and printing needs only the view orders permission", async ({ request }) => {
    expect((await buyer.request.get(`${API}/admin/orders/labels?ids=${orders[0]}`, { headers: asBrowser })).status()).toBe(403);
    expect((await buyer.request.post(`${API}/admin/orders/bulk-ship`, { data: { ids: [orders[0]] }, headers: asBrowser })).status()).toBe(403);

    const made = await request.post(`${API}/admin/roles`, { data: { name: `Print only ${stamp}`, description: "", permissions: ["orders.view"] }, headers: asBrowser });
    expect(made.status()).toBe(201);
    const roleId = ((await made.json()) as { id: string }).id;
    const found = (await (await request.get(`${API}/admin/users?q=${encodeURIComponent(`Pat Packer ${stamp}`)}`, { headers: asBrowser })).json()) as { items: { id: string }[] };
    expect((await request.patch(`${API}/admin/users/${found.items[0].id}/role`, { data: { role: "STAFF", staffRoleId: roleId }, headers: asBrowser })).status()).toBe(200);

    expect((await packer.request.get(`${API}/admin/orders/labels?ids=${orders[0]}`, { headers: asBrowser })).status()).toBe(200);
    expect((await packer.request.post(`${API}/admin/orders/bulk-ship`, { data: { ids: [orders[0]], courierName: "Delhivery" }, headers: asBrowser })).status()).toBe(403);
  });

  test("an admin ticks orders and prints labels, then packing slips", async ({ page }) => {
    await page.goto("/admin/orders");
    await page.getByLabel(`Select order ${orders[0].slice(-8)}`).check();
    await page.getByLabel(`Select order ${orders[1].slice(-8)}`).check();
    await expect(page.getByText("2 selected")).toBeVisible();

    const [labels] = await Promise.all([page.waitForEvent("popup"), page.getByRole("link", { name: "Print shipping labels" }).click()]);
    await expect(labels.getByRole("heading", { name: "Shipping labels" })).toBeVisible();
    await expect(labels.getByLabel(`Shipping label ${ref(orders[0])}`)).toContainText("COLLECT");
    await expect(labels.getByLabel(`Shipping label ${ref(orders[1])}`)).toContainText("Label Buyer");
    await expect(labels.getByLabel(`Shipping label ${ref(orders[1])}`)).toContainText("411001");
    await expect(labels.getByLabel(`Shipping label ${ref(orders[1])}`)).toContainText("Near the park");

    await labels.getByRole("link", { name: "Packing slips instead" }).click();
    await expect(labels.getByRole("heading", { name: "Packing slips" })).toBeVisible();
    await expect(labels.getByLabel(`Packing slip ${ref(orders[0])}`)).toContainText("Ship Lamp");
    await expect(labels.getByRole("button", { name: "Print" })).toBeVisible();
    await labels.close();
  });

  test("tracking numbers typed for a bulk shipment are checked before anything ships", async ({ request }) => {
    const post = (data: Record<string, unknown>) => request.post(`${API}/admin/orders/bulk-ship`, { data: { ids: [orders[0], orders[1]], ...data }, headers: asBrowser });
    const number = (id: string, trackingNumber: string) => ({ id, trackingNumber });
    const noCourier = await post({ trackingNumbers: [number(orders[0], "TRK1")] });
    expect(noCourier.status()).toBe(400);
    expect(JSON.stringify(await noCourier.json())).toContain("courier name");
    expect((await post({ courierName: "Delhivery", trackingNumbers: [number(orders[0], "SAME1"), number(orders[1], "same1")] })).status()).toBe(400);
    expect((await post({ courierName: "Delhivery", trackingNumbers: [number(orders[0], "bad!")] })).status()).toBe(400);
    expect((await post({ courierName: "Delhivery", trackingUrlTemplate: "https://courier.example/track" })).status()).toBe(400);
    expect((await post({ courierName: "Delhivery", trackingUrlTemplate: "http://courier.example/{number}" })).status()).toBe(400);
    const list = (await (await request.get(`${API}/admin/orders`, { headers: asBrowser })).json()) as { id: string; status: string }[];
    expect(list.find((o) => o.id === orders[0])!.status).toBe("PLACED");
  });

  test("shipping in bulk marks the ready orders, adds each tracking number and says why it left one out", async ({ page, request }) => {
    await page.goto("/admin/orders");
    for (const id of orders) await page.getByLabel(`Select order ${id.slice(-8)}`).check();
    await page.getByRole("button", { name: "Mark as shipped\u2026" }).click();
    await page.getByLabel("Courier for all of them").fill("Delhivery");
    await page.getByLabel(`Tracking number for ${ref(orders[0])}`).fill(`TRK${stamp}`);
    await page.getByText("Paste a list from the courier").click();
    await page.getByLabel("Tracking list").fill(`#${ref(orders[1])} TRK${stamp}B\nNOSUCH99 12345`);
    await page.getByRole("button", { name: "Fill the numbers" }).click();
    await expect(page.getByLabel(`Tracking number for ${ref(orders[1])}`)).toHaveValue(`TRK${stamp}B`);
    await page.getByLabel(/Tracking link for the customer/).fill("https://courier.example/track/{number}");
    await page.getByRole("button", { name: "Mark as shipped", exact: true }).click();
    await expect(page.getByText(/2 orders marked as shipped\./)).toBeVisible();
    await expect(page.getByText(new RegExp(`1 left out: #${ref(orders[2])} \\(already shipped\\)`))).toBeVisible();

    const all = (await (await request.get(`${API}/admin/orders`, { headers: asBrowser })).json()) as { id: string; status: string; courierName: string | null; trackingNumber: string | null; trackingUrl: string | null }[];
    expect(all.find((x) => x.id === orders[0])).toMatchObject({ status: "SHIPPED", courierName: "Delhivery", trackingNumber: `TRK${stamp}`, trackingUrl: `https://courier.example/track/TRK${stamp}` });
    expect(all.find((x) => x.id === orders[1])).toMatchObject({ status: "SHIPPED", trackingNumber: `TRK${stamp}B`, trackingUrl: `https://courier.example/track/TRK${stamp}B` });
  });

  test("the audit log records the bulk shipment", async ({ request }) => {
    const log = (await (await request.get(`${API}/admin/audit-log`, { headers: asBrowser })).json()) as { items: { action: string; summary: string }[] };
    expect(log.items.find((e) => e.action === "order.bulk-ship")).toMatchObject({ summary: "Marked 3 orders as shipped with Delhivery" });
  });
});
