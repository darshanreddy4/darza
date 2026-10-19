import { expect, test } from "@playwright/test";
import { API, AUTH_FILES, CUSTOMER, money } from "./data";
import { asBrowser, findUser } from "./helpers";

// Runs after the order flow, so the customer has one shipped order of ₹298.
test.use({ storageState: AUTH_FILES.admin });

test.describe("admin user details", () => {
  test("the list shows the phone and address the customer gave", async ({ page }) => {
    await page.goto("/admin/users");
    // Many other specs create customers, so look the person up instead of relying on the first page.
    await page.getByLabel("Search users").fill(CUSTOMER.email);
    const row = page.getByRole("row", { name: new RegExp(CUSTOMER.email) });
    await expect(row).toContainText("9876543210");
    await expect(row).toContainText("12 Test Street");
  });

  test("clicking a name shows what they bought", async ({ page }) => {
    await page.goto("/admin/users");
    // Many other specs create customers, so look the person up instead of relying on the first page.
    await page.getByLabel("Search users").fill(CUSTOMER.email);
    await page.getByRole("link", { name: CUSTOMER.name }).click();
    await expect(page.getByRole("heading", { name: CUSTOMER.name })).toBeVisible();
    await expect(page.getByText("9876543210").first()).toBeVisible();

    const bought = page.getByRole("table").filter({ hasText: "Bought" });
    await expect(bought.getByRole("row", { name: /E2E USB-C Cable/ })).toContainText("1");
    await expect(page.getByText("Total spent").locator("..")).toContainText(money(29800));
    await expect(page.getByText("Order history")).toBeVisible();
  });

  test("the list can be exported as a CSV file", async ({ page }) => {
    await page.goto("/admin/users");
    // Many other specs create customers, so look the person up instead of relying on the first page.
    await page.getByLabel("Search users").fill(CUSTOMER.email);
    await expect(page.getByText(CUSTOMER.email)).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^dmg-users-\d{4}-\d{2}-\d{2}\.csv$/);
    const path = await download.path();
    const text = (await import("fs")).readFileSync(path, "utf8");
    expect(text).toContain("Name,Email,Email verified,Role,Phone,Address");
    expect(text).toContain(`${CUSTOMER.name},${CUSTOMER.email},Yes,CUSTOMER,9876543210,`);
    expect(text).toContain("298.00");
  });

  test("the export and details are for admins only", async ({ browser, request }) => {
    const user = await findUser(request, CUSTOMER.email);
    const customer = await browser.newContext({ storageState: AUTH_FILES.customer });
    expect((await customer.request.get(`${API}/admin/users/export`, { headers: asBrowser })).status()).toBe(403);
    expect((await customer.request.get(`${API}/admin/users/${user.id}`, { headers: asBrowser })).status()).toBe(403);
    await customer.close();
  });

  test("a refunded order shows up as returned and no longer as spend", async ({ page, request }) => {
    const user = await findUser(request, CUSTOMER.email);
    const detail = await (await request.get(`${API}/admin/users/${user.id}`, { headers: asBrowser })).json();
    const order = detail.orders.find((o: { status: string }) => o.status === "SHIPPED");
    const res = await request.patch(`${API}/admin/orders/${order.id}/status`, { data: { status: "REFUNDED" }, headers: asBrowser });
    expect(res.ok()).toBeTruthy();

    await page.goto(`/admin/users/${user.id}`);
    await expect(page.locator("div.relative").filter({ hasText: "Returned" })).toContainText("1");
    await expect(page.getByRole("row", { name: /E2E USB-C Cable/ }).first()).toBeVisible();
  });
});
