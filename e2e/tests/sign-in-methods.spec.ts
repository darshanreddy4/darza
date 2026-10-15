import { expect, test, type Page } from "@playwright/test";
import { API, AUTH_FILES, PASSWORD, WEB } from "./data";
import { asBrowser } from "./helpers";

// Numbers that look like Indian mobiles, different on every run.
const newPhone = () => `98${String(Date.now()).slice(-8)}`;

async function sendCode(page: Page) {
  const [res] = await Promise.all([page.waitForResponse((r) => r.url().includes("/auth/otp/send")), page.getByRole("button", { name: "Send code" }).click()]);
  return { status: res.status(), body: await res.json().catch(() => ({})) as { devCode?: string; message?: string } };
}

test.describe("sign-in screens", () => {
  test("the login page welcomes people and offers email and mobile number", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Welcome back to DMG/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Email" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Mobile number" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
    await expect(page.getByTestId("google-button")).toHaveCount(0);
  });

  test("the sign-up page explains what you get and asks for the terms", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /Welcome to DMG\./ })).toBeVisible();
    for (const benefit of ["Track every order", "Check out in seconds", "Know who you buy from", "Keep your favourites"]) await expect(page.getByRole("heading", { name: benefit })).toBeVisible();
    const terms = page.getByLabel(/I agree to the/);
    await expect(terms).not.toBeChecked();
    await expect(page.getByRole("link", { name: "Terms & Conditions" })).toHaveAttribute("href", "/terms");
    await expect(page.getByRole("link", { name: "Privacy Policy" }).first()).toHaveAttribute("href", "/privacy");
  });

  test("the password field can be shown and hides weak choices", async ({ page }) => {
    await page.goto("/signup");
    const pw = page.getByPlaceholder("At least 8 characters");
    await expect(pw).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(pw).toHaveAttribute("type", "text");

    await pw.fill("abc");
    await expect(page.getByText("Too short")).toBeVisible();
    await pw.fill("Tr1cky-Horse-Battery");
    await expect(page.getByText("Strong")).toBeVisible();
  });

  test("email sign-up needs the terms ticked and a decent password", async ({ page }) => {
    const email = `terms-${Date.now()}@dmg.test`;
    await page.goto("/signup");
    await page.getByPlaceholder("Your name").fill("Terms Tester");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("At least 8 characters").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("accept the Terms");
    await expect(page).toHaveURL(/\/signup/);

    await page.getByLabel(/I agree to the/).check();
    await page.getByPlaceholder("At least 8 characters").fill("Password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("too common");

    await page.getByPlaceholder("At least 8 characters").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).not.toHaveURL(/\/signup/);
    await expect(page.getByText(/Please verify your email address/)).toBeVisible();
  });

  test("the API refuses a sign-up that did not accept the terms", async ({ request }) => {
    const res = await request.post(`${API}/auth/register`, { data: { name: "No Terms", email: `noterms-${Date.now()}@dmg.test`, password: PASSWORD }, headers: asBrowser });
    expect(res.status()).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("Terms");
  });

  test("the sign-in options are published for the screens", async ({ request }) => {
    const res = await request.get(`${API}/auth/providers`);
    expect(await res.json()).toEqual({ google: null, phone: true });
  });
});

test.describe.serial("mobile number accounts", () => {
  const phone = newPhone();
  const name = "Phone Shopper";

  test("sign up with a number, a name and the terms, then a one-time code", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("tab", { name: "Mobile number" }).click();

    // Name and terms come first.
    await page.getByPlaceholder("98765 43210").fill(phone);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("name");
    await page.getByPlaceholder("Your name").fill(name);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("accept the Terms");

    await page.getByLabel(/I agree to the/).check();
    const sent = await sendCode(page);
    expect(sent.status).toBe(201);
    expect(sent.body.devCode).toMatch(/^\d{6}$/);
    await expect(page.getByText(/We sent a 6-digit code to/)).toBeVisible();
    await expect(page.getByText(/Resend in \d+s/)).toBeVisible();

    await page.getByPlaceholder("••••••").fill("000000" === sent.body.devCode ? "111111" : "000000");
    await expect(page.locator("main").getByRole("alert")).toContainText("not right");
    await expect(page.locator("main").getByRole("alert")).toContainText("4 tries left");

    await page.getByPlaceholder("••••••").fill(sent.body.devCode!);
    await expect(page).not.toHaveURL(/\/signup/);
    await expect(page.getByText(name.split(" ")[0]).first()).toBeVisible();
  });

  test("the account page shows the verified number, and no email prompts appear", async ({ page, context }) => {
    // A fresh browser session proves a cookie from the sign-up works, so log in again by code.
    await context.clearCookies();
    await page.waitForTimeout(3200); // the resend gap
    await page.goto("/login");
    await page.getByRole("tab", { name: "Mobile number" }).click();
    await page.getByPlaceholder("98765 43210").fill(phone);
    const sent = await sendCode(page);
    expect(sent.body.devCode).toMatch(/^\d{6}$/);
    await page.getByPlaceholder("••••••").fill(sent.body.devCode!);
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto("/account");
    await expect(page.locator("dt", { hasText: "Mobile number" })).toBeVisible();
    await expect(page.locator("main").getByText(`+91${phone}`).first()).toBeVisible();
    await expect(page.getByText("Verified").first()).toBeVisible();
    await expect(page.getByText(/Please verify your email/)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Change password" })).toHaveCount(0);
  });

  test("a number-only customer can check out", async ({ page, context }) => {
    await context.clearCookies();
    await page.waitForTimeout(3200); // the resend gap
    await page.goto("/login");
    await page.getByRole("tab", { name: "Mobile number" }).click();
    await page.getByPlaceholder("98765 43210").fill(`+91 ${phone.slice(0, 5)} ${phone.slice(5)}`);
    const sent = await sendCode(page);
    await page.getByPlaceholder("••••••").fill(sent.body.devCode!);
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto("/products/e2e-power-bank");
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await page.goto("/checkout");
    await expect(page.getByRole("button", { name: /place order/i })).toBeEnabled();
  });

  test("the same number cannot sign up twice, and unknown numbers get no hint", async ({ page, request }) => {
    const dup = await request.post(`${API}/auth/otp/send`, { data: { phone, purpose: "signup" }, headers: asBrowser });
    expect(dup.status()).toBe(409);

    const unknown = await request.post(`${API}/auth/otp/send`, { data: { phone: newPhone().replace(/^98/, "97"), purpose: "login" }, headers: asBrowser });
    expect(unknown.status()).toBe(201);
    expect((await unknown.json()).devCode).toBeUndefined();

    await page.goto("/login");
    await page.getByRole("tab", { name: "Mobile number" }).click();
    await page.getByPlaceholder("98765 43210").fill("12345");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("valid mobile number");
  });

  test("codes cannot be requested again straight away, or guessed", async ({ request }) => {
    await new Promise((r) => setTimeout(r, 3200));
    const again = await request.post(`${API}/auth/otp/send`, { data: { phone, purpose: "login" }, headers: asBrowser });
    expect(again.status()).toBe(201);
    const tooSoon = await request.post(`${API}/auth/otp/send`, { data: { phone, purpose: "login" }, headers: asBrowser });
    expect(tooSoon.status()).toBe(429);

    let last = 0;
    for (let i = 0; i < 6; i++) {
      last = (await request.post(`${API}/auth/otp/verify`, { data: { phone, purpose: "login", code: "000000" }, headers: asBrowser })).status();
    }
    expect(last).toBe(400);
    const locked = await request.post(`${API}/auth/otp/verify`, { data: { phone, purpose: "login", code: "000000" }, headers: asBrowser });
    expect(JSON.stringify(await locked.json())).toMatch(/Too many wrong attempts/);
  });

  test("admins see the number-only account in the users list", async ({ browser }) => {
    const admin = await browser.newContext({ storageState: AUTH_FILES.admin, baseURL: WEB });
    const page = await admin.newPage();
    await page.goto("/admin/users");
    await page.getByLabel("Search users").fill(phone);
    const row = page.getByRole("row", { name: new RegExp(`${name}.*${phone}`) });
    await expect(row).toContainText("No email");
    await expect(row).toContainText("Phone");
    await expect(row).toContainText(`+91${phone}`);
    await admin.close();
  });
});
