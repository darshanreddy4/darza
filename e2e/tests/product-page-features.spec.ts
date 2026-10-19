import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { API, AUTH_FILES, WEB, money } from "./data";
import { asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin, viewport: { width: 1280, height: 900 } });

const signedOut = { cookies: [], origins: [] };
const shipping = { name: "Page Buyer", phone: "9876500021", line1: "21 Page Road", city: "Pune", state: "Maharashtra", pincode: "411001" };
const ids: Record<string, string> = {};

test.describe.serial("product page features", () => {
  let categoryId = "";
  let buyer: BrowserContext;

  const dto = (over: Record<string, unknown>) => ({
    description: "Used to test the product page.", categoryId, productType: "OWN", status: "PUBLISHED", images: [], pricePaise: 69900, stock: 20, ...over,
  });
  const create = async (request: APIRequestContext, slug: string, over: Record<string, unknown>) => {
    const res = await request.post(`${API}/admin/products`, { data: dto({ name: `E2E ${slug}`, slug, sku: slug.toUpperCase(), ...over }), headers: asBrowser });
    expect(res.ok(), await res.text()).toBeTruthy();
    ids[slug] = (await res.json()).id;
  };
  const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

  test.beforeAll(async ({ browser, request }) => {
    const cats = (await (await request.get(`${API}/admin/categories`, { headers: asBrowser })).json()) as { id: string }[];
    categoryId = cats[0].id;
    await create(request, "e2e-sale-pot", { brand: "E2E Cello", salePricePaise: 27900, saleEndsAt: inHours(2.4), warranty: "1 year warranty", manufacturerInfo: "Country of origin: India\nPacked by: E2E Industries, Pune" });
    await create(request, "e2e-sale-over-pot", { salePricePaise: 1000, saleEndsAt: new Date(Date.now() - 60_000).toISOString() });
    await create(request, "e2e-var-blue-15", { variantGroup: "e2e-var-pot", colorName: "Blue", packSize: "1500 ml" });
    await create(request, "e2e-var-blue-20", { variantGroup: "e2e-var-pot", colorName: "Blue", packSize: "2000 ml", stock: 0 });
    await create(request, "e2e-var-red-15", { variantGroup: "e2e-var-pot", colorName: "Red", packSize: "1500 ml" });
    await create(request, "e2e-review-pot", {});
    buyer = await newCustomer(browser, "Page Buyer");
  });

  test.afterAll(async ({ request }) => {
    await buyer.close();
    for (const [slug, id] of Object.entries(ids)) {
      const res = await request.put(`${API}/admin/products/${id}`, { data: dto({ name: `E2E ${slug}`, slug, sku: slug.toUpperCase(), status: "DRAFT" }), headers: asBrowser });
      if (!res.ok()) await request.delete(`${API}/admin/products/${id}`, { headers: asBrowser });
    }
  });

  test("a running sale shows its price, its countdown and a deal tag", async ({ page, request }) => {
    const pub = (await (await request.get(`${API}/products/e2e-sale-pot`)).json()) as { pricePaise: number; mrpPaise: number; sale: { endsAt: string } | null };
    expect(pub.pricePaise).toBe(27900);
    expect(pub.mrpPaise).toBe(69900);
    expect(pub.sale?.endsAt).toBeTruthy();

    await page.goto("/products/e2e-sale-pot");
    const timer = page.getByRole("timer");
    await expect(timer).toHaveAttribute("aria-label", /^Sale ends in 2 hours \d+ minutes$/);
    await expect(timer).toContainText("Sale ends in");
    for (const unit of ["Hrs", "Min", "Sec"]) await expect(timer).toContainText(unit);
    const seconds = () => timer.locator("span.tabular-nums").last().innerText();
    const before = await seconds();
    await expect.poll(seconds, { timeout: 5000 }).not.toBe(before);
    await expect(page.getByText("Sale price", { exact: true })).toBeVisible();
    await expect(page.getByText(money(27900)).first()).toBeVisible();

    await page.goto("/products?type=OWN");
    const card = page.getByRole("heading", { name: "E2E e2e-sale-pot" }).locator("xpath=ancestor::div[contains(@class,'group')][1]");
    await expect(card.getByText("Limited-time deal")).toBeVisible();
  });

  test("the sale price is what the cart and the order charge", async ({ request }) => {
    const quote = (await (await request.post(`${API}/checkout/quote`, { data: { items: [{ productId: ids["e2e-sale-pot"], quantity: 2 }] }, headers: asBrowser })).json()) as { subtotalPaise: number };
    expect(quote.subtotalPaise).toBe(55800);
    const order = await buyer.request.post(`${API}/orders`, { data: { items: [{ productId: ids["e2e-sale-pot"], quantity: 1 }], shipping, paymentMethod: "COD" }, headers: asBrowser });
    expect(order.status(), await order.text()).toBe(201);
    expect(((await order.json()) as { order: { subtotalPaise: number; items: { pricePaise: number }[] } }).order).toMatchObject({ subtotalPaise: 27900, items: [{ pricePaise: 27900 }] });
  });

  test("a sale whose time has passed does nothing", async ({ page, request }) => {
    const pub = (await (await request.get(`${API}/products/e2e-sale-over-pot`)).json()) as { pricePaise: number; sale: unknown };
    expect(pub.pricePaise).toBe(69900);
    expect(pub.sale).toBeNull();
    await page.goto("/products/e2e-sale-over-pot");
    await expect(page.getByRole("timer")).toHaveCount(0);
    await expect(page.getByText("Sale price", { exact: true })).toHaveCount(0);
  });

  test("the timer runs out and the normal price comes back by itself", async ({ page, request }) => {
    test.setTimeout(90_000);
    await create(request, "e2e-sale-short", { salePricePaise: 30000, saleEndsAt: new Date(Date.now() + 9000).toISOString() });
    await page.goto("/products/e2e-sale-short");
    await expect(page.getByRole("timer")).toBeVisible();
    await expect(page.getByText(money(30000)).first()).toBeVisible();
    await expect(page.getByRole("timer")).toHaveAttribute("aria-label", "Sale ended", { timeout: 20_000 });
    // Any admin save refreshes the shop's short-lived copy, so the page can pick up the normal price straight away.
    await request.put(`${API}/admin/products/${ids["e2e-sale-over-pot"]}`, { data: dto({ name: "E2E e2e-sale-over-pot", slug: "e2e-sale-over-pot", sku: "E2E-SALE-OVER-POT", description: "Touched." }), headers: asBrowser });
    await expect(page.getByRole("timer")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText(money(69900)).first()).toBeVisible();
  });

  test("colour and size options link the products of one item together", async ({ page }) => {
    await page.goto("/products/e2e-var-blue-15");
    await expect(page.getByText("Colour:", { exact: false }).first()).toContainText("Blue");
    await expect(page.getByRole("link", { name: "Colour Blue, selected" })).toHaveAttribute("href", "/products/e2e-var-blue-15");
    await expect(page.getByRole("link", { name: "Colour Red" })).toHaveAttribute("href", "/products/e2e-var-red-15");
    const sizes = page.getByRole("list").filter({ has: page.getByRole("link", { name: /2000 ml/ }) });
    await expect(sizes.getByRole("link", { name: "1500 ml" })).toHaveAttribute("aria-current", "true");
    await expect(sizes.getByRole("link", { name: /2000 ml \(sold out\)/ })).toHaveClass(/line-through/);
    await page.getByRole("link", { name: "Colour Red" }).click();
    await expect(page).toHaveURL(/\/products\/e2e-var-red-15$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E e2e-var-red-15");
    // A product that is alone in its group shows no options.
    await page.goto("/products/e2e-sale-pot");
    await expect(page.getByRole("link", { name: /^Colour / })).toHaveCount(0);
  });

  test("warranty, manufacturer details, brand store and buying promises are on the page", async ({ page }) => {
    await page.goto("/products/e2e-sale-pot");
    await expect(page.getByRole("link", { name: "Visit brand store" })).toHaveAttribute("href", "/products?q=E2E%20Cello");
    await expect(page.getByText("1 year warranty").first()).toBeVisible();
    const makers = page.getByRole("region", { name: "Manufacturer and packer details" }).or(page.locator("#manufacturer"));
    await expect(makers).toContainText("Country of origin: India");
    await expect(makers).toContainText("Packed by: E2E Industries, Pune");
    const trust = page.getByRole("list", { name: "Buying with confidence" });
    await expect(trust).toContainText("Pay on delivery");
    await expect(trust).toContainText(/\d+-day returns/);
    await expect(trust).toContainText("Cancel before it ships");
  });

  test("reviews slide, and after eight a View all page lists every review", async ({ page, browser, request }) => {
    const post = async (n: number) => {
      const c = await newCustomer(browser, `Reviewer ${n}`);
      const res = await c.request.post(`${API}/products/e2e-review-pot/reviews`, { data: { rating: n % 5 + 1, title: `Title ${n}`, body: `Review number ${n} for the pot.` }, headers: asBrowser });
      expect(res.ok(), await res.text()).toBeTruthy();
      await c.close();
    };
    for (let n = 1; n <= 8; n++) await post(n);
    await page.goto("/products/e2e-review-pot");
    const reviews = page.locator("#reviews");
    await expect(reviews.getByRole("article")).toHaveCount(8);
    await expect(reviews.getByRole("link", { name: /View all/ })).toHaveCount(0);

    await post(9);
    await page.reload();
    await expect(reviews.getByRole("article")).toHaveCount(8);
    const next = reviews.getByRole("button", { name: "Next reviews" });
    const prev = reviews.getByRole("button", { name: "Previous reviews" });
    await expect(prev).toBeDisabled();
    await next.click();
    await expect(prev).toBeEnabled();
    await expect(reviews.getByText("based on 9 reviews")).toBeVisible();
    await expect(reviews.getByRole("list", { name: "Reviews by stars" })).toBeVisible();

    await reviews.getByRole("link", { name: "View all 9 reviews" }).click();
    await expect(page).toHaveURL(/\/products\/e2e-review-pot\/reviews$/);
    await expect(page.getByRole("heading", { name: "Customer reviews" })).toBeVisible();
    await expect(page.getByRole("region", { name: "All reviews" }).getByRole("article")).toHaveCount(9);
    await page.getByRole("link", { name: "Highest rated" }).click();
    await expect(page).toHaveURL(/sort=highest/);
    await expect(page.getByRole("region", { name: "All reviews" }).getByRole("article").first()).toContainText("Review number");
    await page.getByRole("link", { name: "Back to product" }).click();
    await expect(page).toHaveURL(/\/products\/e2e-review-pot$/);

    const second = (await (await request.get(`${API}/products/e2e-review-pot/reviews?page=2&limit=5&sort=lowest`)).json()) as { page: number; pages: number; count: number; items: { rating: number }[]; breakdown: Record<string, number> };
    expect(second).toMatchObject({ page: 2, pages: 2, count: 9 });
    expect(second.items).toHaveLength(4);
    expect(Object.values(second.breakdown).reduce((a, b) => a + b, 0)).toBe(9);
    const lowest = (await (await request.get(`${API}/products/e2e-review-pot/reviews?limit=1&sort=lowest`)).json()) as { items: { rating: number }[] };
    expect(lowest.items[0].rating).toBe(1);
  });

  test("every product has a share button that copies a link which opens the product", async ({ browser, context, page }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: WEB });
    await page.addInitScript(() => { Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); });

    await page.goto("/products?type=OWN");
    const card = page.getByRole("heading", { name: "E2E e2e-review-pot" }).locator("xpath=ancestor::div[contains(@class,'group')][1]");
    await card.getByRole("button", { name: "Share this product" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${WEB}/products/e2e-review-pot`);

    await page.goto("/products/e2e-sale-pot");
    await page.getByRole("heading", { level: 1 }).locator("..").getByRole("button", { name: "Share this product" }).click();
    const menu = page.getByRole("group", { name: "Share this product" });
    await expect(menu.getByLabel("Product link")).toHaveValue(`${WEB}/products/e2e-sale-pot`);
    await expect(menu.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", new RegExp(encodeURIComponent(`${WEB}/products/e2e-sale-pot`)));
    for (const name of ["Facebook", "X", "Telegram", "Email"]) await expect(menu.getByRole("link", { name })).toBeVisible();
    await menu.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    // Anyone with the link, signed in or not, lands on the product.
    const visitor = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const shared = await visitor.newPage();
    await shared.goto(`${WEB}/products/e2e-sale-pot`);
    await expect(shared.getByRole("heading", { level: 1 })).toHaveText("E2E e2e-sale-pot");
    await visitor.close();
  });

  test("the phone shows a buy bar once the main buttons scroll away", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/products/e2e-review-pot");
    await expect(page.getByRole("button", { name: "Quick add" })).toHaveCount(0);
    await page.getByRole("button", { name: "Got it" }).click();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByRole("button", { name: "Quick add" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Buy at/ })).toBeVisible();
    await page.getByRole("button", { name: "Quick add" }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("dmg-cart") ?? "[]").length)).toBe(1);
  });

  const addToCart = async (page: Page, slug: string) => {
    await page.goto(`/products/${slug}`);
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await page.getByRole("link", { name: "Go to cart" }).click();
  };

  test.describe("signed out", () => {
    test.use({ storageState: signedOut });

    test("proceeding to checkout asks a guest to sign up or log in, then opens the login page", async ({ page }) => {
      await addToCart(page, "e2e-review-pot");
      await page.getByRole("link", { name: /checkout/i }).first().click();
      const prompt = page.getByRole("dialog", { name: "Please sign up or log in to proceed further" });
      await expect(prompt).toBeVisible();
      await expect(page).toHaveURL(/\/cart$/);

      await page.keyboard.press("Escape");
      await expect(prompt).toHaveCount(0);
      await page.getByRole("link", { name: /checkout/i }).first().click();
      await prompt.getByRole("button", { name: "Not now" }).click();
      await expect(prompt).toHaveCount(0);

      await page.getByRole("link", { name: /checkout/i }).first().click();
      await expect(prompt.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup?next=%2Fcheckout");
      await prompt.getByRole("link", { name: "Log in" }).click();
      await expect(page).toHaveURL(/\/login\?next=%2Fcheckout$/);
    });

    test("Buy now does the same for a guest", async ({ page }) => {
      await page.goto("/products/e2e-review-pot");
      await page.getByRole("button", { name: "Buy now" }).click();
      await expect(page.getByRole("dialog", { name: "Please sign up or log in to proceed further" })).toBeVisible();
      await page.getByRole("dialog").getByRole("link", { name: "Log in" }).click();
      await expect(page).toHaveURL(/\/login\?next=%2Fcheckout$/);
    });
  });

  test.describe("signed in", () => {
    test.use({ storageState: AUTH_FILES.customer });

    test("a customer goes straight to checkout with no prompt", async ({ page }) => {
      await addToCart(page, "e2e-review-pot");
      await page.getByRole("link", { name: /checkout/i }).first().click();
      await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await page.goto("/products/e2e-var-red-15");
      await page.getByRole("button", { name: "Buy now" }).click();
      await expect(page).toHaveURL(/\/checkout$/);
      await expect(page.getByText("E2E e2e-var-red-15").first()).toBeVisible();
    });
  });

  test("the admin form saves a timed sale, colour options, warranty and manufacturer", async ({ page, request }) => {
    await page.goto(`/admin/products/${ids["e2e-review-pot"]}`);
    await page.getByLabel(/^Run a timed sale/).check();
    await page.getByLabel(/^Sale price/).fill("450");
    await page.getByLabel(/^Sale ends/).fill("2099-01-01T10:30");
    await page.getByLabel(/^Group name/).fill("e2e-review-group");
    await page.getByLabel(/^Colour/).fill("Green");
    await page.getByLabel(/^Warranty/).fill("6 months");
    await page.getByLabel(/^Manufacturer, packer/).fill("Made in India");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    const saved = (await (await request.get(`${API}/products/e2e-review-pot`)).json()) as Record<string, unknown>;
    expect(saved).toMatchObject({ pricePaise: 45000, mrpPaise: 69900, colorName: "Green", warranty: "6 months", manufacturerInfo: "Made in India" });
    expect((saved.sale as { endsAt: string }).endsAt).toMatch(/^(2098-12-31|2099-01-01)T/);
  });

  test("a sale needs a lower price and an end time, and only suits our own products", async ({ request }) => {
    const base = { name: "E2E Bad Sale", slug: "e2e-bad-sale", sku: "E2E-BAD-SALE" };
    for (const over of [{ salePricePaise: 1000 }, { saleEndsAt: inHours(1) }, { salePricePaise: 69900, saleEndsAt: inHours(1) }, { salePricePaise: 1000, saleEndsAt: "soon" }, { variantGroup: "bad group!" }]) {
      const res = await request.post(`${API}/admin/products`, { data: dto({ ...base, ...over }), headers: asBrowser });
      expect(res.status(), JSON.stringify(over)).toBe(400);
    }
    const partner = await request.post(`${API}/admin/products`, { data: dto({ ...base, slug: "e2e-partner-sale", sku: undefined, stock: undefined, productType: "AFFILIATE", platform: "Amazon", affiliateUrl: "https://example.com/p", salePricePaise: 1000, saleEndsAt: inHours(1) }), headers: asBrowser });
    expect(partner.ok(), await partner.text()).toBeTruthy();
    const made = (await partner.json()) as { id: string; salePricePaise: number | null };
    expect(made.salePricePaise).toBeNull();
    await request.delete(`${API}/admin/products/${made.id}`, { headers: asBrowser });
  });
});
