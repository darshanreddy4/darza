import { expect, test } from "@playwright/test";
import { ADMIN, AUTH_FILES, CUSTOMER, PASSWORD } from "./data";

test.describe("accounts", () => {
  test("a wrong password is rejected with a clear message", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("you@example.com").fill(CUSTOMER.email);
    await page.getByPlaceholder("••••••••").fill("not-the-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("a customer can log in and log out", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("you@example.com").fill(CUSTOMER.email);
    await page.getByPlaceholder("••••••••").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(CUSTOMER.name.split(" ")[0]).first()).toBeVisible();

    await page.locator("summary", { hasText: CUSTOMER.name }).click();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("link", { name: /log ?in/i }).first()).toBeVisible();
  });

  test("signing up creates an account that must confirm its email", async ({ page }) => {
    const email = `new-${Date.now()}@dmg.test`;
    await page.goto("/signup");
    await page.getByPlaceholder("Your name").fill("New Shopper");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("At least 8 characters").fill(PASSWORD);
    await page.getByLabel(/I agree to the/).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/Please verify your email address/)).toBeVisible();
  });

  test("forgot password never reveals whether an email exists", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByPlaceholder("you@example.com").fill("nobody-here@dmg.test");
    await page.getByRole("button", { name: /send/i }).click();
    await expect(page.getByText(/if an account|check your email|we.ve sent/i).first()).toBeVisible();
  });

  test("checkout asks visitors to log in first", async ({ page }) => {
    await page.goto("/products/e2e-power-bank");
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("admin area access", () => {
  test("visitors are sent to log in", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/login/);
  });

  test.describe("as a customer", () => {
    test.use({ storageState: AUTH_FILES.customer });
    test("the admin area is refused", async ({ page }) => {
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();
    });
    test("the admin API is refused", async ({ request }) => {
      const res = await request.get(`${process.env.E2E_API_URL ?? "http://localhost:4100"}/admin/users`, { headers: { origin: process.env.E2E_WEB_URL ?? "http://localhost:3100" } });
      expect(res.status()).toBe(403);
    });
  });

  test.describe("as an admin", () => {
    test.use({ storageState: AUTH_FILES.admin });
    test("the dashboard opens", async ({ page }) => {
      await page.goto("/admin");
      await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
      await expect(page.getByText(ADMIN.name).first()).toBeVisible();
    });
  });
});
