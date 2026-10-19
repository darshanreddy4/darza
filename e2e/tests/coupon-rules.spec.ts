import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES, CUSTOMER, WEB } from "./data";
import { asBrowser, newCustomer, withDb } from "./helpers";

test.use({ storageState: AUTH_FILES.admin, viewport: { width: 1280, height: 900 } });

const json = { ...asBrowser, "content-type": "application/json" };
const signedOut = { cookies: [], origins: [] };
const ids: Record<string, string> = {};

type Customer = BrowserContext & { phone: string };
interface Quote { subtotalPaise: number; discountPaise: number; shippingPaise: number; totalPaise: number; couponError: string | null; rewards: { next: { title: string } | null } }

// Rules the big marketplaces follow: free delivery is judged on the cart before a coupon, and a code is used up per person (account, email address and mobile number), per code, and never twice at once.
test.describe.serial("coupon rules", () => {
  let categoryId = "";
  let original: Record<string, unknown>;
  let a: Customer, b: Customer, c: Customer, d: Customer;
  const made: Record<string, Record<string, unknown>> = {};

  const coupon = async (request: APIRequestContext, code: string, over: Record<string, unknown> = {}) => {
    const dto = { code, type: "FLAT", value: 5000, ...over };
    const res = await request.post(`${API}/admin/coupons`, { data: dto, headers: json });
    expect(res.status(), await res.text()).toBe(201);
    made[code] = dto;
    ids[code] = (await res.json()).id;
  };
  const product = async (request: APIRequestContext, slug: string, pricePaise: number) => {
    const res = await request.post(`${API}/admin/products`, { data: { name: `E2E ${slug}`, slug, sku: slug.toUpperCase(), description: "Used to test coupons.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], stock: 60, pricePaise }, headers: asBrowser });
    expect(res.ok(), await res.text()).toBeTruthy();
    ids[slug] = (await res.json()).id;
  };
  const quote = async (ctx: BrowserContext, code: string, slug = "e2e-cpn-big", qty = 1) => {
    const res = await ctx.request.post(`${API}/checkout/quote`, { data: { items: [{ productId: ids[slug], quantity: qty }], couponCode: code }, headers: json });
    return (await res.json()) as Quote;
  };
  const place = (ctx: BrowserContext, code: string, phone: string, slug = "e2e-cpn-big") =>
    ctx.request.post(`${API}/orders`, {
      data: { items: [{ productId: ids[slug], quantity: 1 }], couponCode: code, shipping: { name: "Coupon Buyer", phone, line1: "5 Coupon Road", city: "Pune", state: "Maharashtra", pincode: "411001" }, paymentMethod: "COD" },
      headers: json,
    });
  const orderId = async (res: Awaited<ReturnType<typeof place>>) => {
    expect(res.status(), await res.text()).toBe(201);
    return ((await res.json()) as { order: { id: string } }).order.id;
  };
  const message = async (res: Awaited<ReturnType<typeof place>>) => {
    expect(res.status()).toBe(400);
    return ((await res.json()) as { message: string | string[] }).message.toString();
  };

  test.beforeAll(async ({ browser, request }) => {
    const cats = (await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[];
    categoryId = cats[0].id;
    original = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Record<string, unknown>;
    // Delivery ₹50, free from ₹500.
    await saveSettings(request, original, { shippingFeePaise: 5000, freeShippingOverPaise: 50000, freeAllOverPaise: 0, deliveryZones: [], giftTiers: [] });
    await product(request, "e2e-cpn-big", 55000);
    await product(request, "e2e-cpn-small", 30000);
    // One at a time: the helper picks the mobile number from the clock.
    a = await newCustomer(browser, "Coupon A");
    b = await newCustomer(browser, "Coupon B");
    c = await newCustomer(browser, "Coupon C");
    d = await newCustomer(browser, "Coupon D");
    // A and B are the same person on two accounts: Gmail ignores dots and +tags.
    await withDb((db) => db.$executeRawUnsafe(`UPDATE "User" SET email = $1 WHERE phone = $2`, "dup.person@gmail.com", `+91${a.phone}`));
    await withDb((db) => db.$executeRawUnsafe(`UPDATE "User" SET email = $1 WHERE phone = $2`, "dupperson+deals@gmail.com", `+91${b.phone}`));
  });

  test.afterAll(async ({ request }) => {
    await Promise.all([a, b, c, d].map((x) => x?.close()));
    await saveSettings(request, original, {
      shippingFeePaise: original.shippingFeePaise, freeShippingOverPaise: original.freeShippingOverPaise ?? 0, freeAllOverPaise: original.freeAllOverPaise ?? 0,
      deliveryZones: original.deliveryZones, giftTiers: original.giftTiers,
    });
    for (const [code, dto] of Object.entries(made)) {
      const res = await request.delete(`${API}/admin/coupons/${ids[code]}`, { headers: asBrowser });
      if (!res.ok()) await request.put(`${API}/admin/coupons/${ids[code]}`, { data: { ...dto, active: false }, headers: json });
    }
    for (const slug of ["e2e-cpn-big", "e2e-cpn-small"]) {
      await request.put(`${API}/admin/products/${ids[slug]}`, { data: { name: `E2E ${slug}`, slug, sku: slug.toUpperCase(), description: "Used to test coupons.", categoryId, productType: "OWN", status: "DRAFT", images: [], stock: 60, pricePaise: 1000 }, headers: asBrowser });
    }
  });

  test("a coupon does not take away free delivery that the cart had earned", async ({ browser, request }) => {
    await coupon(request, "CPNFLAT50", { value: 5000 });
    await coupon(request, "CPNHALF", { type: "PERCENT", value: 50 });
    const guest = await browser.newContext({ storageState: signedOut });
    // ₹550 of goods qualifies for free delivery; the ₹50 coupon only lowers what is paid.
    expect(await quote(guest, "")).toMatchObject({ subtotalPaise: 55000, shippingPaise: 0, totalPaise: 55000 });
    expect(await quote(guest, "CPNFLAT50")).toMatchObject({ discountPaise: 5000, shippingPaise: 0, totalPaise: 50000, couponError: null });
    expect(await quote(guest, "CPNHALF")).toMatchObject({ discountPaise: 27500, shippingPaise: 0, totalPaise: 27500 });
    // A cart that never reached ₹500 still pays delivery, coupon or not.
    expect(await quote(guest, "CPNFLAT50", "e2e-cpn-small")).toMatchObject({ discountPaise: 5000, shippingPaise: 5000, totalPaise: 30000 });
    await guest.close();
  });

  test("the cart shows the coupon and free delivery together", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.evaluate((id) => {
      localStorage.setItem("dmg-cart", JSON.stringify([{ productId: id, slug: "e2e-cpn-big", name: "E2E e2e-cpn-big", image: null, pricePaise: 55000, quantity: 1 }]));
      localStorage.setItem("dmg-coupon", "CPNFLAT50");
    }, ids["e2e-cpn-big"]);
    await page.goto("/cart");
    const summary = page.locator("aside");
    await expect(summary).toContainText("Discount (CPNFLAT50)");
    await expect(summary.getByText("Free", { exact: true })).toBeVisible();
    await expect(summary).not.toContainText("more to get free delivery");
    await expect(page.getByRole("region", { name: "Rewards for your order" })).toContainText("You have unlocked every reward");
    await ctx.close();
  });

  test("a code for one use per customer cannot be used twice, and a cancelled order gives the use back", async ({ request }) => {
    await coupon(request, "CPNONCE", { perUserLimit: 1 });
    const first = await orderId(await place(c, "CPNONCE", c.phone));
    expect((await quote(c, "CPNONCE")).couponError).toBe("You have already used this code");
    expect(await message(await place(c, "CPNONCE", c.phone))).toContain("already used");
    // Somebody else can still have their own use.
    expect((await quote(d, "CPNONCE")).couponError).toBeNull();

    const cancelled = await request.patch(`${API}/admin/orders/${first}/status`, { data: { status: "CANCELLED" }, headers: json });
    expect(cancelled.ok(), await cancelled.text()).toBeTruthy();
    expect((await quote(c, "CPNONCE")).couponError).toBeNull();
    await orderId(await place(c, "CPNONCE", c.phone));
  });

  test("the same person on a second account is recognised by email address or mobile number", async ({ request }) => {
    await coupon(request, "CPNIDENT", { perUserLimit: 1 });
    await orderId(await place(a, "CPNIDENT", a.phone));
    // B's email is A's with a +tag and no dot: the same Gmail address.
    expect((await quote(b, "CPNIDENT")).couponError).toBe("This code has already been used with your email address or mobile number");
    expect(await message(await place(b, "CPNIDENT", b.phone))).toContain("email address or mobile number");
    // A different person who gives A's mobile number for delivery is stopped too.
    expect(await message(await place(d, "CPNIDENT", a.phone))).toContain("email address or mobile number");
    // And a genuinely different person is fine.
    expect((await quote(d, "CPNIDENT")).couponError).toBeNull();
    await orderId(await place(d, "CPNIDENT", d.phone));
  });

  test("a code with a total limit is used up for everyone, and two orders at once cannot both take the last use", async ({ request }) => {
    await coupon(request, "CPNLAST", { usageLimit: 1 });
    const results = await Promise.all([place(a, "CPNLAST", a.phone), place(b, "CPNLAST", b.phone)]);
    expect(results.map((r) => r.status()).sort()).toEqual([201, 400]);
    const loser = results.find((r) => r.status() === 400)!;
    expect(((await loser.json()) as { message: string }).message).toBe("This code has reached its usage limit");
    expect((await quote(c, "CPNLAST")).couponError).toBe("This code has reached its usage limit");

    const list = (await (await request.get(`${API}/admin/coupons`, { headers: asBrowser })).json()) as { code: string; timesUsed: number; discountGivenPaise: number }[];
    expect(list.find((x) => x.code === "CPNLAST")).toMatchObject({ timesUsed: 1, discountGivenPaise: 5000 });
  });

  test("a code made for chosen customers, by email or mobile number, works only for them and only once each", async ({ browser, request }) => {
    await coupon(request, "CPNTEAM", { customers: `${CUSTOMER.email}\n${c.phone}` });
    const owner = await browser.newContext({ storageState: AUTH_FILES.customer, baseURL: WEB });
    expect((await quote(owner, "CPNTEAM")).couponError).toBeNull();
    expect((await quote(c, "CPNTEAM")).couponError).toBeNull();
    expect((await quote(d, "CPNTEAM")).couponError).toBe("This code is not valid for your account");
    const guest = await browser.newContext({ storageState: signedOut });
    expect((await quote(guest, "CPNTEAM")).couponError).toBe("Log in to use this code");

    await orderId(await place(c, "CPNTEAM", c.phone));
    expect((await quote(c, "CPNTEAM")).couponError).toBe("You have already used this code");
    // The other chosen customer still has theirs.
    expect((await quote(owner, "CPNTEAM")).couponError).toBeNull();
    await owner.close(); await guest.close();

    const rows = (await (await request.get(`${API}/admin/coupons`, { headers: asBrowser })).json()) as { code: string; customers: unknown[] }[];
    expect(rows.find((x) => x.code === "CPNTEAM")?.customers).toHaveLength(2);
  });

  test("a code that has been used cannot be deleted, and the admin can see who used it", async ({ page, request }) => {
    expect((await request.delete(`${API}/admin/coupons/${ids["CPNONCE"]}`, { headers: asBrowser })).status()).toBe(409);
    await page.goto("/admin/coupons");
    await page.getByRole("row", { name: /CPNONCE/ }).getByRole("button", { name: "Usage" }).click();
    const usage = page.getByRole("table", { name: "Orders that used this code" });
    await expect(usage).toContainText("Coupon C");
    await expect(usage).toContainText("Released (cancelled)");
    await expect(usage.getByText("Yes", { exact: true })).toBeVisible();
  });

  test("an unknown code is refused, in any case, and an expired or switched-off code says why", async ({ request }) => {
    await coupon(request, "CPNOFF", { active: false });
    await coupon(request, "CPNOLD", { endsAt: new Date(Date.now() + 1500).toISOString(), startsAt: new Date(Date.now() - 86_400_000).toISOString() });
    await new Promise((r) => setTimeout(r, 2000));
    expect((await quote(d, "cpnoff")).couponError).toBe("This code is not active");
    expect((await quote(d, "cpnold")).couponError).toBe("This code has expired");
    expect((await quote(d, "NOSUCHCODE")).couponError).toBe("This code isn't valid");
    expect((await quote(d, "cpnflat50")).couponError).toBeNull();
  });
});

// The settings form sends every field, so changes start from what is saved.
async function saveSettings(request: APIRequestContext, s: Record<string, unknown>, over: Record<string, unknown>) {
  const body = {
    shippingFeePaise: s.shippingFeePaise, freeShippingOverPaise: s.freeShippingOverPaise ?? 0, gstEnabled: s.gstEnabled, gstin: s.gstin ?? "", legalName: s.legalName ?? "",
    businessAddress: s.businessAddress ?? "", businessState: s.businessState ?? "", shippingGstPercent: s.shippingGstPercent, invoicePrefix: s.invoicePrefix, ...over,
  };
  const res = await request.put(`${API}/admin/settings`, { data: body, headers: json });
  expect(res.ok(), await res.text()).toBeTruthy();
}
