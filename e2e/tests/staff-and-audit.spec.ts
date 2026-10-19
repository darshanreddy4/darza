import { pick } from "./helpers";
import { expect, test, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { adminProduct, asBrowser, expectOptions, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

// A new name each run, so the spec works on a database that has seen it before.
const STAFF_NAME = `Sam Staff ${Date.now()}`;

test.describe.serial("staff role and audit log", () => {
  let staff: BrowserContext;
  let orderId = "";
  const ref = () => `#${orderId.slice(-8).toUpperCase()}`;

  test.beforeAll(async ({ browser, request }) => {
    staff = await newCustomer(browser, STAFF_NAME);
    const buyer = await newCustomer(browser, "Order Buyer");
    const product = await adminProduct(request, "e2e-power-bank");
    const res = await buyer.request.post(`${API}/orders`, { data: { items: [{ productId: product.id, quantity: 1 }], shipping: { name: "Order Buyer", phone: "9876500020", line1: "20 Staff Road", city: "Pune", state: "Maharashtra", pincode: "411001" }, paymentMethod: "COD" }, headers: asBrowser });
    expect(res.status()).toBe(201);
    orderId = ((await res.json()) as { order: { id: string } }).order.id;
    await buyer.close();
  });

  test.afterAll(async () => { await staff.close(); });

  test("an admin makes someone staff from the users page", async ({ page }) => {
    await page.goto("/admin/users");
    await page.getByLabel("Search users").fill(STAFF_NAME);
    const select = page.getByLabel(/Role for /);
    await expect(select).toHaveCount(1);
    page.once("dialog", (d) => d.accept());
    await pick(select, "STAFF");
    await expect(page.getByText(/is now staff/)).toBeVisible();
  });

  test("staff can work orders, returns and questions, and never see costs", async () => {
    const orders = await staff.request.get(`${API}/admin/orders`, { headers: asBrowser });
    expect(orders.status()).toBe(200);
    const list = (await orders.json()) as { id: string; items: Record<string, unknown>[] }[];
    expect(list.find((o) => o.id === orderId)).toBeTruthy();
    expect(JSON.stringify(list)).not.toContain("costPaise");

    const products = await staff.request.get(`${API}/admin/products`, { headers: asBrowser });
    expect(products.status()).toBe(200);
    expect(JSON.stringify(await products.json())).not.toContain("costPaise");

    for (const path of ["/admin/returns", "/admin/questions", "/admin/categories", "/admin/stock-alerts"]) {
      expect((await staff.request.get(`${API}${path}`, { headers: asBrowser })).status(), path).toBe(200);
    }
  });

  test("everything else is refused", async () => {
    for (const path of ["/admin/settings", "/admin/users", "/admin/audit-log", "/admin/analytics/sales", "/admin/coupons", "/admin/abandoned-carts", "/admin/products/export", "/admin/site-profile"]) {
      expect((await staff.request.get(`${API}${path}`, { headers: asBrowser })).status(), path).toBe(403);
    }
    const create = await staff.request.post(`${API}/admin/products`, { data: { name: "x" }, headers: asBrowser });
    expect(create.status()).toBe(403);
    expect((await staff.request.put(`${API}/admin/settings`, { data: {}, headers: asBrowser })).status()).toBe(403);
  });

  test("staff can ship an order but not cancel or refund it", async () => {
    const ship = await staff.request.patch(`${API}/admin/orders/${orderId}/status`, { data: { status: "SHIPPED" }, headers: asBrowser });
    expect(ship.ok()).toBeTruthy();
    for (const status of ["CANCELLED", "REFUNDED"]) {
      const res = await staff.request.patch(`${API}/admin/orders/${orderId}/status`, { data: { status }, headers: asBrowser });
      expect(res.status()).toBe(403);
      expect(JSON.stringify(await res.json())).toContain("Only an admin");
    }
  });

  test("the staff console shows only what staff can use", async () => {
    const page = await staff.newPage();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/orders/);

    const nav = page.getByRole("navigation", { name: "Admin" });
    for (const name of ["Orders", "Returns", "Questions", "Products"]) await expect(nav.getByRole("link", { name })).toBeVisible();
    for (const name of ["Users", "Settings", "Audit log", "Coupons", "Analytics"]) await expect(nav.getByRole("link", { name })).toHaveCount(0);
    await expect(page.getByText("Staff console")).toBeVisible();

    await page.getByRole("button", { name: ref() }).click();
    const status = page.getByLabel(`Status for order ${orderId.slice(-8)}`);
    await expectOptions(status, { present: ["Delivered"], absent: ["Cancelled", "Refunded"] });

    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/admin\/orders/);

    await page.goto("/admin/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
    await expect(page.getByRole("link", { name: "+ Add product" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Import CSV" })).toHaveCount(0);
    await expect(page.getByText("E2E Power Bank 10000mAh")).toBeVisible();
    await page.close();
  });

  test("the audit log records who did what, including blocked attempts", async ({ request }) => {
    const res = await request.get(`${API}/admin/audit-log`, { headers: asBrowser });
    expect(res.status()).toBe(200);
    const log = (await res.json()) as { items: { actorName: string; actorRole: string; action: string; summary: string }[]; actors: { name: string }[] };

    const promoted = log.items.find((e) => e.action === "user.role");
    expect(promoted).toMatchObject({ actorName: "E2E Admin", actorRole: "ADMIN", summary: "Set a user's role to staff" });

    const shipped = log.items.find((e) => e.action === "order.status" && e.summary === `Set order ${ref()} to shipped`);
    expect(shipped).toMatchObject({ actorName: STAFF_NAME, actorRole: "STAFF" });

    const blocked = log.items.find((e) => e.action === "order.status.blocked" && e.summary.includes(ref()));
    expect(blocked).toMatchObject({ actorName: STAFF_NAME, actorRole: "STAFF" });
    expect(blocked!.summary.startsWith("Blocked: set order")).toBe(true);
    expect(log.actors.map((a) => a.name)).toContain(STAFF_NAME);
  });

  test("a change attempted by someone without the role is noted too", async ({ request }) => {
    const attempt = await staff.request.put(`${API}/admin/settings`, { data: { shippingFeePaise: 0 }, headers: asBrowser });
    expect(attempt.status()).toBe(403);
    const log = (await (await request.get(`${API}/admin/audit-log`, { headers: asBrowser })).json()) as { items: { actorName: string; action: string; summary: string }[] };
    expect(log.items.find((e) => e.action === "settings.update.blocked")).toMatchObject({ actorName: STAFF_NAME, summary: "Blocked: changed store settings" });
  });

  test("admins read the log on a page and can filter by person", async ({ page }) => {
    await page.goto("/admin/audit-log");
    await expect(page.getByRole("row", { name: new RegExp(`${STAFF_NAME} Staff Set order ${ref()} to shipped`) })).toBeVisible();
    await pick(page.getByLabel("Filter by person"), { label: STAFF_NAME });
    await expect(page.getByRole("row", { name: /E2E Admin/ })).toHaveCount(0);
    await expect(page.getByRole("row", { name: new RegExp(`Set order ${ref()} to shipped`) })).toBeVisible();
    await page.getByRole("button", { name: "Details" }).first().click();
    await expect(page.locator("pre").first()).toBeVisible();
  });

  test("passwords and long text never reach the log", async ({ request }) => {
    const log = (await (await request.get(`${API}/admin/audit-log?limit=200`, { headers: asBrowser })).json()) as { items: { details: unknown }[] };
    expect(JSON.stringify(log.items)).not.toMatch(/E2e-Pass-12345/);
  });
});
