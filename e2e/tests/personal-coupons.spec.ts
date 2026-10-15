import { expect, test, type APIRequestContext } from "@playwright/test";
import { API, AUTH_FILES, CUSTOMER, WEB } from "./data";
import { adminProduct, asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const json = { ...asBrowser, "content-type": "application/json" };

test.describe.serial("personal and first-order coupons", () => {
  const made: string[] = [];
  let productId = "";

  test.beforeAll(async ({ request }) => { productId = (await adminProduct(request, "e2e-power-bank")).id; });
  test.afterAll(async ({ request }) => { for (const id of made) await request.delete(`${API}/admin/coupons/${id}`, { headers: asBrowser }); });

  const quote = async (ctx: APIRequestContext, code: string) => {
    const res = await ctx.post(`${API}/checkout/quote`, { data: { items: [{ productId, quantity: 1 }], couponCode: code }, headers: json });
    return (await res.json()) as { discountPaise: number; couponError: string | null };
  };

  test("the admin makes a code for one customer", async ({ page, request }) => {
    await page.goto("/admin/coupons");
    await page.getByRole("button", { name: "+ New coupon" }).click();
    await page.getByLabel(/^Code/).fill("VIPONLY");
    await page.getByLabel(/^Percentage/).fill("20");
    await page.getByLabel(/Only for one customer/).fill("nobody@dmg.test");
    await page.getByRole("button", { name: "Create coupon" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No customer has that email" })).toBeVisible();

    await page.getByLabel(/Only for one customer/).fill(CUSTOMER.email);
    await page.getByRole("button", { name: "Create coupon" }).click();
    await expect(page.getByText("Coupon created")).toBeVisible();
    await expect(page.getByRole("row", { name: /VIPONLY/ })).toContainText(`Only for ${CUSTOMER.name}`);
    await expect(page.getByRole("row", { name: /VIPONLY/ })).toContainText("1 per customer");

    const list = (await (await request.get(`${API}/admin/coupons`, { headers: asBrowser })).json()) as { id: string; code: string }[];
    made.push(list.find((c) => c.code === "VIPONLY")!.id);
  });

  test("only that customer can use it, and they see it in their account", async ({ browser }) => {
    const owner = await browser.newContext({ storageState: AUTH_FILES.customer, baseURL: WEB });
    const mine = await quote(owner.request, "VIPONLY");
    expect(mine.couponError).toBeNull();
    expect(mine.discountPaise).toBe(29980);

    const other = await newCustomer(browser, "Someone Else");
    expect((await quote(other.request, "VIPONLY")).couponError).toBe("This code is not valid for your account");
    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    expect((await quote(guest.request, "VIPONLY")).couponError).toBe("Log in to use this code");
    await guest.close();

    const page = await owner.newPage();
    await page.goto("/account");
    const card = page.getByRole("listitem").filter({ hasText: "VIPONLY" });
    await expect(card).toContainText("20% off");
    await card.getByRole("link", { name: "Use in cart" }).click();
    await expect(page).toHaveURL(/\/cart/);
    expect(await page.evaluate(() => localStorage.getItem("dmg-coupon"))).toBe("VIPONLY");

    // Someone else's account does not list it.
    const otherPage = await other.newPage();
    await otherPage.goto("/account");
    await expect(otherPage.getByRole("heading", { name: "Your coupons" })).toHaveCount(0);
    await owner.close(); await other.close();
  });

  test("a first-order code stops working after the first order", async ({ browser, request }) => {
    const res = await request.post(`${API}/admin/coupons`, { data: { code: "WELCOME15", type: "PERCENT", value: 15, firstOrderOnly: true }, headers: json });
    expect(res.status()).toBe(201);
    made.push((await res.json()).id);

    const buyer = await newCustomer(browser, "Fresh Buyer");
    expect((await quote(buyer.request, "WELCOME15")).discountPaise).toBe(22485);
    const order = await buyer.request.post(`${API}/orders`, {
      data: { items: [{ productId, quantity: 1 }], couponCode: "WELCOME15", shipping: { name: "Fresh Buyer", phone: "9876500004", line1: "4 Coupon Road", city: "Pune", state: "Maharashtra", pincode: "411001" }, paymentMethod: "COD" },
      headers: json,
    });
    expect(order.status()).toBe(201);
    expect((await quote(buyer.request, "WELCOME15")).couponError).toBe("This code is for your first order only");

    const again = await buyer.request.post(`${API}/orders`, {
      data: { items: [{ productId, quantity: 1 }], couponCode: "WELCOME15", shipping: { name: "Fresh Buyer", phone: "9876500004", line1: "4 Coupon Road", city: "Pune", state: "Maharashtra", pincode: "411001" }, paymentMethod: "COD" },
      headers: json,
    });
    expect(again.status()).toBe(400);
    await buyer.close();
  });
});
