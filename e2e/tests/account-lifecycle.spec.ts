import { pick } from "./helpers";
import { expect, test, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES, PASSWORD, WEB } from "./data";
import { adminProduct, asBrowser, knownLinkToken, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const shipping = { name: "Account Tester", phone: "9876500077", line1: "7 Lifecycle Lane", city: "Pune", state: "Maharashtra", pincode: "411001" };
const short = (id: string) => id.slice(-8).toUpperCase();
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const newPhone = () => `97${String(Date.now()).slice(-8)}`;

async function placeCod(customer: BrowserContext, productId: string) {
  const res = await customer.request.post(`${API}/orders`, { data: { items: [{ productId, quantity: 1 }], shipping, paymentMethod: "COD" }, headers: asBrowser });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { order: { id: string } }).order.id;
}

async function setStatus(request: import("@playwright/test").APIRequestContext, orderId: string, ...statuses: string[]) {
  for (const status of statuses) expect((await request.patch(`${API}/admin/orders/${orderId}/status`, { data: { status }, headers: asBrowser })).ok()).toBeTruthy();
}

test.describe.serial("customers cancelling their own order", () => {
  let customer: BrowserContext;
  let other: BrowserContext;
  let cableId = "";
  let stockBefore = 0;
  let openOrder = "";
  let shippedOrder = "";

  test.beforeAll(async ({ browser, request }) => {
    const cable = await adminProduct(request, "e2e-usb-cable");
    cableId = cable.id; stockBefore = cable.stock ?? 0;
    customer = await newCustomer(browser, "Cancelling Customer");
    other = await newCustomer(browser, "Other Customer");
    openOrder = await placeCod(customer, cableId);
    shippedOrder = await placeCod(customer, cableId);
    await setStatus(request, shippedOrder, "SHIPPED");
  });
  test.afterAll(async ({ request }) => {
    await setStatus(request, shippedOrder, "CANCELLED");
    await customer.close(); await other.close();
  });

  test("an order that has not shipped can be cancelled with a reason and the stock comes back", async ({ request }) => {
    expect((await adminProduct(request, "e2e-usb-cable")).stock).toBe(stockBefore - 2);
    const page = await customer.newPage();
    await page.goto("/orders");
    const card = page.getByRole("listitem").filter({ hasText: `#${short(openOrder)}` }).last();
    await card.getByRole("button", { name: "Cancel order" }).click();
    await pick(card.getByLabel("Why are you cancelling?"), "Ordered by mistake");
    await card.getByLabel(/Anything to add/).fill("wrong colour");
    await card.getByRole("button", { name: "Yes, cancel order" }).click();
    await expect(card.getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(card.getByText("Cancellation reason: Ordered by mistake: wrong colour")).toBeVisible();
    await expect(card.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
    expect((await adminProduct(request, "e2e-usb-cable")).stock).toBe(stockBefore - 1);
    await page.close();
  });

  test("cancelling twice, a shipped order or someone else's order is refused", async () => {
    const again = await customer.request.post(`${API}/orders/${openOrder}/cancel`, { data: { reason: "Other" }, headers: asBrowser });
    expect(again.status()).toBe(409);
    const shipped = await customer.request.post(`${API}/orders/${shippedOrder}/cancel`, { data: { reason: "Other" }, headers: asBrowser });
    expect(shipped.status()).toBe(409);
    expect(JSON.stringify(await shipped.json())).toContain("already shipped");
    expect((await other.request.post(`${API}/orders/${shippedOrder}/cancel`, { data: { reason: "Other" }, headers: asBrowser })).status()).toBe(404);
    expect((await customer.request.post(`${API}/orders/${shippedOrder}/cancel`, { data: { reason: "Because" }, headers: asBrowser })).status()).toBe(400);

    const page = await customer.newPage();
    await page.goto("/orders");
    const card = page.getByRole("listitem").filter({ hasText: `#${short(shippedOrder)}` }).last();
    await expect(card.getByText("Shipped", { exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
    await page.close();
  });

  test("the admin can see why it was cancelled", async ({ request }) => {
    const orders = (await (await request.get(`${API}/admin/orders`, { headers: asBrowser })).json()) as { id: string; status: string; cancelReason: string | null }[];
    const found = orders.find((o) => o.id === openOrder)!;
    expect(found.status).toBe("CANCELLED");
    expect(found.cancelReason).toBe("Ordered by mistake: wrong colour");
  });
});

test.describe.serial("adding the missing ways to sign in", () => {
  test("a phone-only account adds an email address, confirms it, sets a password and signs in with it", async ({ browser }) => {
    const customer = await newCustomer(browser, "Phone Only");
    const page = await customer.newPage();
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Password", exact: true })).toBeVisible();
    await expect(page.getByText(/Add an email address above/)).toBeVisible();

    const email = `added-${unique()}@dmg.test`;
    await page.getByRole("button", { name: "Add email address" }).click();
    await page.getByRole("textbox", { name: "Email address" }).fill(email);
    await page.getByRole("button", { name: "Send confirmation link" }).click();
    await expect(page.getByRole("status").filter({ hasText: `We sent a link to ${email}` })).toBeVisible();
    // Until the link is opened the address is not on the account.
    const before = (await (await customer.request.get(`${API}/auth/me`)).json()) as { user: { email: string | null } };
    expect(before.user.email).toBeNull();

    await page.goto(`/verify-email?token=${await knownLinkToken("EMAIL_ADD", email)}`);
    await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
    await page.goto("/account");
    await expect(page.locator("main").getByText(email).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Set a password" })).toBeVisible();

    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByLabel("Confirm password").fill("short");
    await page.getByRole("button", { name: "Set password" }).click();
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Set password" }).click();
    await expect(page.getByText("Password set. You can now sign in with your email and password.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();

    const fresh = await browser.newContext({ baseURL: WEB });
    const login = await fresh.request.post(`${API}/auth/login`, { data: { email, password: PASSWORD }, headers: asBrowser });
    expect(login.ok()).toBeTruthy();
    const me = (await (await fresh.request.get(`${API}/auth/me`)).json()) as { user: { name: string; phone: string | null; hasPassword: boolean } };
    expect(me.user).toMatchObject({ name: "Phone Only", hasPassword: true });
    expect(me.user.phone).toBeTruthy();
    await fresh.close(); await customer.close();
  });

  test("a phone-only account cannot set a password without an email, nor change one it never had", async ({ browser }) => {
    const customer = await newCustomer(browser, "No Email Yet");
    const set = await customer.request.post(`${API}/auth/set-password`, { data: { newPassword: PASSWORD }, headers: asBrowser });
    expect(set.status()).toBe(400);
    expect(JSON.stringify(await set.json())).toContain("Add an email address first");
    const change = await customer.request.post(`${API}/auth/change-password`, { data: { currentPassword: "anything-here", newPassword: PASSWORD }, headers: asBrowser });
    expect(change.status()).toBe(400);
    expect(JSON.stringify(await change.json())).toContain("not set a password");
    // An address someone else already uses is refused.
    const taken = await customer.request.post(`${API}/auth/email`, { data: { email: "e2e-customer@dmg.test" }, headers: asBrowser });
    expect(taken.status()).toBe(409);
    await customer.close();
  });

  test("an email account adds a mobile number with a code and becomes verified", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: WEB });
    const email = `has-email-${unique()}@dmg.test`;
    expect((await context.request.post(`${API}/auth/register`, { data: { email, name: "Email Only", password: PASSWORD, termsAccepted: true }, headers: asBrowser })).ok()).toBeTruthy();
    const page = await context.newPage();
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();

    const phone = newPhone();
    await page.getByRole("button", { name: "Add mobile number" }).click();
    await page.getByLabel("Mobile number").fill(phone);
    const [sent] = await Promise.all([page.waitForResponse((r) => r.url().includes("/auth/phone/send")), page.getByRole("button", { name: "Send code" }).click()]);
    const { devCode } = (await sent.json()) as { devCode: string };
    await page.getByLabel(/6-digit code sent to/).fill("000000");
    await page.getByRole("button", { name: "Add number" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /not right/ })).toBeVisible();
    await page.getByLabel(/6-digit code sent to/).fill(devCode);
    await page.getByRole("button", { name: "Add number" }).click();
    await expect(page.getByRole("form", { name: "Phone code form" })).toHaveCount(0);
    await expect(page.getByText(phone.slice(-10)).first()).toBeVisible();

    const me = (await (await context.request.get(`${API}/auth/me`)).json()) as { user: { phone: string; verified: boolean } };
    expect(me.user.verified).toBe(true);
    expect(me.user.phone).toContain(phone.slice(-10));

    // The same number cannot be added to a second account.
    const second = await browser.newContext({ baseURL: WEB });
    expect((await second.request.post(`${API}/auth/register`, { data: { email: `second-${unique()}@dmg.test`, name: "Second", password: PASSWORD, termsAccepted: true }, headers: asBrowser })).ok()).toBeTruthy();
    expect((await second.request.post(`${API}/auth/phone/send`, { data: { phone }, headers: asBrowser })).status()).toBe(409);
    await second.close(); await context.close();
  });

  test("linking Google is hidden and refused while Google sign-in is not configured", async ({ browser }) => {
    const customer = await newCustomer(browser, "Google Later");
    const page = await customer.newPage();
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Ways to sign in and get updates" })).toBeVisible();
    await expect(page.getByTestId("google-button")).toHaveCount(0);
    const res = await customer.request.post(`${API}/auth/google/link`, { data: { credential: "x".repeat(40) }, headers: asBrowser });
    expect(res.status()).toBe(503);
    await customer.close();
  });
});

test.describe.serial("downloading and deleting an account", () => {
  let customer: BrowserContext;
  let phone = "";
  let orderId = "";

  test.beforeAll(async ({ browser, request }) => {
    customer = await newCustomer(browser, "Leaving Customer");
    phone = (customer as unknown as { phone: string }).phone;
    orderId = await placeCod(customer, (await adminProduct(request, "e2e-usb-cable")).id);
  });
  test.afterAll(async () => { await customer.close(); });

  test("the customer can download a copy of their data", async ({ browser }) => {
    const page = await customer.newPage();
    await page.goto("/account");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download my data" }).click()]);
    expect(download.suggestedFilename()).toBe("my-data.json");
    const { readFile } = await import("node:fs/promises");
    const text = await readFile((await download.path())!, "utf8");
    const data = JSON.parse(text) as { name: string; orders: { id: string; items: { product: { name: string } }[] }[]; signInMethods: { phone: boolean; password: boolean } };
    expect(data.name).toBe("Leaving Customer");
    expect(data.orders.map((o) => o.id)).toContain(orderId);
    expect(data.orders[0].items[0].product.name).toBe("E2E USB-C Cable");
    expect(data.signInMethods).toEqual({ email: false, phone: true, google: false, password: false });
    expect(text).not.toMatch(/passwordHash|tokenVersion/);
    await page.close();

    // Contexts made from the browser inherit the admin login set above, so start this one signed out.
    const anonymous = await browser.newContext({ baseURL: WEB, storageState: { cookies: [], origins: [] } });
    expect((await anonymous.request.get(`${API}/me/export`, { headers: asBrowser })).status()).toBe(401);
    await anonymous.close();
  });

  test("deleting is refused while an order is still on its way, and needs the confirmation word and a code", async () => {
    const page = await customer.newPage();
    await page.goto("/account");
    await page.getByRole("button", { name: "Delete my account" }).first().click();
    const form = page.getByRole("form", { name: "Delete account" });
    // The test setup only lets a number ask for a new code every few seconds.
    await page.waitForTimeout(3500);
    const [sent] = await Promise.all([page.waitForResponse((r) => r.url().includes("/me/delete/code")), form.getByRole("button", { name: /Text a code/ }).click()]);
    const { devCode } = (await sent.json()) as { devCode: string };
    await form.getByLabel("6-digit code").fill(devCode);
    await form.getByLabel(/Type DELETE/).fill("delete");
    await form.getByRole("button", { name: "Permanently delete my account" }).click();
    await expect(form.getByRole("alert")).toContainText("Type DELETE to confirm");
    await form.getByLabel(/Type DELETE/).fill("DELETE");
    await form.getByRole("button", { name: "Permanently delete my account" }).click();
    await expect(form.getByRole("alert")).toContainText("has not been delivered");
    await page.close();
  });

  test("after the order is cancelled the account is deleted, signed out and its details released", async ({ browser, request }) => {
    expect((await customer.request.post(`${API}/orders/${orderId}/cancel`, { data: { reason: "No longer need it" }, headers: asBrowser })).ok()).toBeTruthy();
    const page = await customer.newPage();
    await page.goto("/account");
    await page.getByRole("button", { name: "Delete my account" }).first().click();
    const form = page.getByRole("form", { name: "Delete account" });
    // The test setup only lets a number ask for a new code every few seconds.
    await page.waitForTimeout(3500);
    const [sent] = await Promise.all([page.waitForResponse((r) => r.url().includes("/me/delete/code")), form.getByRole("button", { name: /Text a code/ }).click()]);
    const { devCode } = (await sent.json()) as { devCode: string };
    await form.getByLabel("6-digit code").fill(devCode);
    await form.getByLabel(/Type DELETE/).fill("DELETE");
    await form.getByRole("button", { name: "Permanently delete my account" }).click();
    await expect(page).toHaveURL(/deleted=1/);

    const me = (await (await customer.request.get(`${API}/auth/me`)).json()) as { user: unknown };
    expect(me.user).toBeNull();
    // The old order stays for the shop's records, under a neutral name; the person no longer appears among customers.
    const orders = (await (await request.get(`${API}/admin/orders`, { headers: asBrowser })).json()) as { id: string; user: { name: string; phone: string | null } }[];
    expect(orders.find((o) => o.id === orderId)!.user).toMatchObject({ name: "Deleted customer", phone: null });
    const users = (await (await request.get(`${API}/admin/users?q=${phone}`, { headers: asBrowser })).json()) as { items: unknown[] };
    expect(users.items).toHaveLength(0);

    // The number is free again for a brand new account.
    // The test setup only lets a number ask for a new code every few seconds.
    await new Promise((r) => setTimeout(r, 3500));
    const again = await browser.newContext({ baseURL: WEB });
    const code = (await (await again.request.post(`${API}/auth/otp/send`, { data: { phone, purpose: "signup" }, headers: asBrowser })).json()) as { devCode: string };
    const signup = await again.request.post(`${API}/auth/otp/verify`, { data: { phone, purpose: "signup", code: code.devCode, name: "Back Again", termsAccepted: true }, headers: asBrowser });
    expect(signup.ok()).toBeTruthy();
    await again.close();
  });
});

test.describe.serial("pay-on-delivery refunds are tracked until they are paid", () => {
  let customer: BrowserContext;
  let orderId = "";
  const upi = "payout.test@okbank";

  test.beforeAll(async ({ browser, request }) => {
    customer = await newCustomer(browser, "Payout Customer");
    orderId = await placeCod(customer, (await adminProduct(request, "e2e-usb-cable")).id);
    await setStatus(request, orderId, "SHIPPED", "DELIVERED");
  });
  test.afterAll(async () => { await customer.close(); });

  test("a cash order's return needs a valid UPI ID to send the money to", async () => {
    const lines = ((await (await customer.request.get(`${API}/orders`)).json()) as { id: string; items: { id: string }[] }[]).find((o) => o.id === orderId)!.items;
    const missing = await customer.request.post(`${API}/orders/${orderId}/return`, { data: { reason: "Other", items: [{ orderItemId: lines[0].id, quantity: 1 }] }, headers: asBrowser });
    expect(missing.status()).toBe(400);
    expect(JSON.stringify(await missing.json())).toContain("UPI ID");
    const bad = await customer.request.post(`${API}/orders/${orderId}/return`, { data: { reason: "Other", upiId: "not a upi", items: [{ orderItemId: lines[0].id, quantity: 1 }] }, headers: asBrowser });
    expect(bad.status()).toBe(400);
    expect(JSON.stringify(await bad.json())).toContain("valid UPI ID");

    const page = await customer.newPage();
    await page.goto("/orders");
    const card = page.getByRole("listitem").filter({ hasText: `#${short(orderId)}` }).last();
    await card.getByRole("button", { name: /Return or refund/ }).click();
    await pick(card.getByLabel("Why are you returning these?"), "Changed my mind");
    await card.getByLabel("UPI ID for your refund").fill(upi);
    await card.getByRole("button", { name: "Send return request" }).click();
    await expect(card.getByText("Return requested")).toBeVisible();
    await page.close();
  });

  test("the admin refunds it, sees it under payouts due, and records the payment", async ({ page, request }) => {
    await page.goto("/admin/returns");
    const row = () => page.getByRole("article", { name: `Return for order ${short(orderId)}` });
    await row().getByRole("button", { name: "Approve return" }).click();
    await pick(page.getByLabel("Filter by status"), "APPROVED");
    page.once("dialog", (d) => { expect(d.message()).toContain("Payouts due"); void d.accept(); });
    await row().getByRole("button", { name: "Item received, refund" }).click();
    await expect(page.getByText("Refund recorded")).toBeVisible();

    await pick(page.getByLabel("Filter by status"), "PAYOUT");
    await expect(row()).toContainText("Payout due");
    await expect(row()).toContainText(upi);
    await expect(row().getByRole("button", { name: "Mark as paid" })).toBeDisabled();

    // The server insists on a reference too.
    const refunded = (await (await request.get(`${API}/admin/returns?status=REFUNDED`, { headers: asBrowser })).json()) as { id: string; orderId?: string; order: { id: string } }[];
    const returnId = refunded.find((r) => r.order.id === orderId)!.id;
    expect((await request.patch(`${API}/admin/returns/${returnId}`, { data: { action: "paid" }, headers: asBrowser })).status()).toBe(400);

    await row().getByLabel("UPI transaction reference").fill("UPI-REF-123456");
    await row().getByRole("button", { name: "Mark as paid" }).click();
    await expect(page.getByText("Payout recorded and the customer was told")).toBeVisible();
    await expect(row()).toHaveCount(0);

    expect((await request.patch(`${API}/admin/returns/${returnId}`, { data: { action: "paid", reference: "again" }, headers: asBrowser })).status()).toBe(409);
    await pick(page.getByLabel("Filter by status"), "REFUNDED");
    await expect(row()).toContainText("Paid to payout.test@okbank");
    await expect(row()).toContainText("UPI-REF-123456");
  });

  test("the customer sees where the money went", async () => {
    const page = await customer.newPage();
    await page.goto("/orders");
    const card = page.getByRole("listitem").filter({ hasText: `#${short(orderId)}` }).last();
    await expect(card.getByText(/Paid to payout.test@okbank on/)).toBeVisible();
    await page.close();
  });
});
