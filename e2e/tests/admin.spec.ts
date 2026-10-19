import { pick } from "./helpers";
import { expect, test } from "@playwright/test";
import { ADMIN, API, AUTH_FILES, CUSTOMER, money } from "./data";
import { adminProduct, asBrowser, findUser } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

test.describe("admin users and roles", () => {
  // Whatever happens, leave the customer as a customer for the other tests.
  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    const user = await findUser(ctx, CUSTOMER.email);
    if (user.role !== "CUSTOMER") await ctx.patch(`${API}/admin/users/${user.id}/role`, { data: { role: "CUSTOMER" }, headers: asBrowser });
    await ctx.dispose();
  });

  test("lists users and filters by search and role", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    const table = page.getByRole("table");
    await expect(page.getByText(CUSTOMER.email)).toBeVisible();
    await expect(table.getByText(ADMIN.email)).toBeVisible();

    await page.getByLabel("Search users").fill("e2e-customer");
    await expect(table.getByText(ADMIN.email)).toHaveCount(0);
    await expect(table.getByText(CUSTOMER.email)).toBeVisible();

    await page.getByLabel("Search users").fill("");
    await pick(page.getByLabel("Filter by role"), "ADMIN");
    await expect(table.getByText(CUSTOMER.email)).toHaveCount(0);
    await expect(table.getByText(ADMIN.email)).toBeVisible();
  });

  test("shows each user's email status", async ({ page }) => {
    await page.goto("/admin/users");
    const row = page.getByRole("row", { name: new RegExp(CUSTOMER.email) });
    await expect(row.getByText("Verified")).toBeVisible();
  });

  test("an admin cannot change their own role", async ({ page, request }) => {
    await page.goto("/admin/users");
    await expect(page.getByLabel(`Role for ${ADMIN.email}`)).toBeDisabled();

    const me = await findUser(request, ADMIN.email);
    const res = await request.patch(`${API}/admin/users/${me.id}/role`, { data: { role: "CUSTOMER" }, headers: asBrowser });
    expect(res.status()).toBe(400);
    expect((await findUser(request, ADMIN.email)).role).toBe("ADMIN");
  });

  test("promotes a customer to admin and back", async ({ page, request, browser }) => {
    await page.goto("/admin/users");
    page.on("dialog", (d) => d.accept());

    await pick(page.getByLabel(`Role for ${CUSTOMER.email}`), "ADMIN");
    await expect(page.getByText(`${CUSTOMER.email} is now an admin`)).toBeVisible();
    expect((await findUser(request, CUSTOMER.email)).role).toBe("ADMIN");

    // The customer's existing session gets admin rights straight away.
    const customer = await browser.newContext({ storageState: AUTH_FILES.customer });
    const open = await customer.request.get(`${API}/admin/users`, { headers: asBrowser });
    expect(open.status()).toBe(200);

    await pick(page.getByLabel(`Role for ${CUSTOMER.email}`), "CUSTOMER");
    await expect(page.getByText(`${CUSTOMER.email} is now a customer`)).toBeVisible();
    const closed = await customer.request.get(`${API}/admin/users`, { headers: asBrowser });
    expect(closed.status()).toBe(403);
    await customer.close();
  });

  test("signing a user out everywhere ends their session", async ({ page, browser }) => {
    // A throwaway account, so the shared customer session used by other tests stays valid.
    const email = `signout-${Date.now()}@dmg.test`;
    const victim = await browser.newContext();
    const signup = await victim.request.post(`${API}/auth/register`, { data: { name: "Sign Out Test", email, password: "E2e-Pass-12345", termsAccepted: true }, headers: asBrowser });
    expect(signup.ok()).toBeTruthy();
    expect((await victim.request.get(`${API}/auth/me`, { headers: asBrowser })).status()).toBe(200);

    await page.goto("/admin/users");
    page.on("dialog", (d) => d.accept());
    await page.getByLabel("Search users").fill(email);
    await page.getByRole("row", { name: new RegExp(email) }).getByRole("button", { name: "Sign out everywhere" }).click();
    await expect(page.getByText(`${email} was signed out everywhere`)).toBeVisible();

    expect((await victim.request.get(`${API}/auth/me`, { headers: asBrowser })).status()).toBe(401);
    await victim.close();
  });
});

test.describe("admin changes reach the storefront at once", () => {
  test("a price change is not hidden by the cache", async ({ page, request }) => {
    const before = await adminProduct(request, "e2e-power-bank");
    // Load the page and the list so any cache is warm.
    await page.goto("/products/e2e-power-bank");
    await expect(page.getByText(money(before.pricePaise)).first()).toBeVisible();
    await page.goto("/products?q=power+bank");
    await expect(page.getByText(money(before.pricePaise)).first()).toBeVisible();

    const set = (pricePaise: number) => request.post(`${API}/admin/products/bulk`, { data: { ids: [before.id], changes: { pricePaise } }, headers: asBrowser });
    try {
      expect((await set(139900)).ok()).toBeTruthy();
      await page.goto("/products/e2e-power-bank");
      await expect(page.getByText(money(139900)).first()).toBeVisible();
      await page.goto("/products?q=power+bank");
      await expect(page.getByText(money(139900)).first()).toBeVisible();
    } finally {
      await set(before.pricePaise);
    }
  });
});

test.describe("coupons", () => {
  test("an admin creates a coupon that shoppers can then use", async ({ page, browser }) => {
    const code = `E2E${Date.now().toString().slice(-6)}`;
    await page.goto("/admin/coupons");
    await page.getByRole("button", { name: "+ New coupon" }).click();
    await page.getByLabel("Code", { exact: false }).first().fill(code);
    await page.getByLabel("Percentage (1-100)").fill("10");
    await page.getByRole("button", { name: "Create coupon" }).click();
    await expect(page.getByText("Coupon created")).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(code) })).toContainText("10% off");

    const customer = await browser.newContext({ storageState: AUTH_FILES.customer });
    const quote = await customer.request.post(`${API}/checkout/quote`, {
      data: { items: [{ productId: (await adminProduct(page.request, "e2e-power-bank")).id, quantity: 1 }], couponCode: code },
      headers: asBrowser,
    });
    expect(quote.ok()).toBeTruthy();
    expect((await quote.json()).discountPaise).toBeGreaterThan(0);
    await customer.close();
  });
});
