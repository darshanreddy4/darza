import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { API, AUTH_FILES, WEB } from "./data";
import { asBrowser } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const put = (request: APIRequestContext, data: object) => request.put(`${API}/admin/appearance`, { data, headers: asBrowser });
const signedOut = { cookies: [], origins: [] };

// Stand-in for the exchange-rate service: one rupee is worth 0.0125 dollars (1 USD = 80 rupees) and 0.0115 euros.
let rateServer: Server;
test.beforeAll(async () => {
  rateServer = createServer((_req, res) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ result: "success", rates: { INR: 1, USD: 0.0125, EUR: 0.0115 } })); });
  await new Promise<void>((r) => rateServer.listen(4199, "127.0.0.1", r));
});
test.afterAll(async ({ request }) => {
  await put(request, { theme: "DEFAULT", currencyCodes: [], currencyDefault: "INR", manualRates: { USD: null, EUR: null } });
  await new Promise<void>((r) => rateServer.close(() => r()));
});

test.describe.serial("choosing the store look", () => {
  test("a fresh store has the original look, and only an admin can change it", async ({ request, browser }) => {
    const pub = (await (await request.get(`${API}/appearance`)).json()) as { theme: string; currency: unknown };
    expect(pub).toEqual({ theme: "DEFAULT", currency: null });

    const customer = await browser.newContext({ baseURL: WEB, storageState: AUTH_FILES.customer });
    expect((await customer.request.put(`${API}/admin/appearance`, { data: { theme: "GLASS" }, headers: asBrowser })).status()).toBe(403);
    const anonymous = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    expect((await anonymous.request.put(`${API}/admin/appearance`, { data: { theme: "GLASS" }, headers: asBrowser })).status()).toBe(401);
    expect((await anonymous.request.get(`${API}/admin/appearance`)).status()).toBe(401);
    await customer.close(); await anonymous.close();

    expect((await put(request, { theme: "NOT-A-LOOK" })).status()).toBe(400);
  });

  test("the original look has no theme marker at all", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.locator("[data-theme]")).toHaveCount(0);
    await ctx.close();
  });

  test("the admin picks a look from the Appearance page and shoppers see it, but the admin console does not", async ({ page, browser }) => {
    await page.goto("/admin/appearance");
    await expect(page.getByRole("heading", { name: "Appearance and currency" })).toBeVisible();
    await page.getByRole("radio", { name: /Glassmorphism/ }).check({ force: true });
    await page.getByRole("button", { name: "Save look" }).click();
    await expect(page.getByText("Saved. The store now uses this look.")).toBeVisible();

    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const shop = await ctx.newPage();
    for (const path of ["/", "/products", "/login"]) {
      await shop.goto(path);
      await expect(shop.locator('[data-theme="glass"]').first(), path).toBeVisible();
    }
    await ctx.close();

    // The console keeps its own look; only the preview tiles on the Appearance page carry a theme.
    await page.goto("/admin");
    await expect(page.locator("[data-theme]")).toHaveCount(0);
  });

  test("going back to Default restores the original look", async ({ request, browser }) => {
    expect((await put(request, { theme: "DEFAULT" })).ok()).toBeTruthy();
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.locator("[data-theme]")).toHaveCount(0);
    await ctx.close();
  });

  const LOOKS = ["MINIMAL", "MAXIMAL", "GLASS", "NEUMORPHIC", "FLAT", "MATERIAL", "EDITORIAL"];
  for (const look of LOOKS) {
    test(`${look}: key pages have no accessibility problems`, async ({ request, browser }) => {
      expect((await put(request, { theme: look })).ok()).toBeTruthy();
      const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut, viewport: { width: 1366, height: 860 } });
      const page = await ctx.newPage();
      for (const path of ["/", "/products", "/products/e2e-power-bank", "/cart", "/login", "/signup", "/contact"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expect(page.locator(`[data-theme="${look.toLowerCase()}"]`).first(), `${look} on ${path}`).toBeVisible();
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const problems = results.violations.map((v) => `${v.id} x${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => `${n.target.join(" ")} ${n.html.slice(0, 140)} ${(n.any[0]?.message ?? "").slice(0, 200)}`).join(" | ")}`);
        expect(problems, `${look} on ${path}`).toEqual([]);
      }
      await ctx.close();
    });
  }

  test("the look is reset after the checks", async ({ request }) => {
    expect((await put(request, { theme: "DEFAULT" })).ok()).toBeTruthy();
  });
});

async function addCable(page: Page) {
  await page.goto("/products/e2e-usb-cable");
  await page.getByRole("button", { name: "Add to Cart" }).click();
}

async function pickCurrency(page: Page, code: string) {
  await page.getByRole("button", { name: "Currency" }).click();
  await page.getByRole("option", { name: new RegExp(`^${code}`) }).click();
}

test.describe.serial("viewing prices in another currency", () => {
  test("no extra currency is offered until the admin turns some on", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/products");
    await expect(page.getByRole("button", { name: "Currency" })).toHaveCount(0);
    await ctx.close();
  });

  test("offered currencies and the default are checked", async ({ request }) => {
    expect((await put(request, { currencyCodes: ["USD"], currencyDefault: "EUR" })).status()).toBe(400);
    expect((await put(request, { currencyCodes: ["USD", "USD"] })).status()).toBe(400);
    expect((await put(request, { currencyCodes: ["XXX"] })).status()).toBe(400);
    expect((await put(request, { manualRates: { USD: -5 } })).status()).toBe(400);
  });

  test("the admin offers dollars and euros and fetches today's rates", async ({ page, request }) => {
    await page.goto("/admin/appearance");
    await page.getByLabel("Offer US dollar").check();
    await page.getByLabel("Offer Euro").check();
    await page.getByRole("button", { name: "Save currencies" }).click();
    await expect(page.getByText(/^Saved/)).toBeVisible();
    await page.getByRole("button", { name: "Fetch today's rates" }).click();
    await expect(page.getByText("Today's exchange rates were fetched.")).toBeVisible();
    // 0.0125 dollars per rupee is 80 rupees per dollar.
    await expect(page.getByRole("row", { name: /USD US dollar/ })).toContainText("80");

    const pub = (await (await request.get(`${API}/appearance`)).json()) as { currency: { default: string; options: { code: string }[] } };
    expect(pub.currency.default).toBe("INR");
    expect(pub.currency.options.map((o) => o.code)).toEqual(["INR", "USD", "EUR"]);
  });

  test("a shopper switches currency, prices convert, the choice sticks, and the cart still says what is charged", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/products");
    await expect(page.getByText("₹1,499").first()).toBeVisible();

    await pickCurrency(page, "USD");
    await expect(page.getByText("$18.74").first()).toBeVisible();
    await expect(page.getByText("₹1,499")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Currency" })).toContainText("USD");
    await expect(page.getByText("$18.74").first()).toBeVisible();

    await addCable(page);
    await page.goto("/cart");
    await expect(page.getByText("$3.74").first()).toBeVisible();
    await expect(page.getByText(/You are charged ₹299 in Indian rupees/)).toBeVisible();

    await pickCurrency(page, "EUR");
    await expect(page.getByText("€3.44").first()).toBeVisible();
    await pickCurrency(page, "INR");
    await expect(page.getByText(/You are charged/)).toHaveCount(0);
    await expect(page.getByText("₹299").first()).toBeVisible();
    await ctx.close();
  });

  test("the admin can fix a rate by hand, and clear it to follow the live rate again", async ({ page, browser, request }) => {
    expect((await put(request, { manualRates: { USD: 100 } })).ok()).toBeTruthy();
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const shop = await ctx.newPage();
    await shop.goto("/products");
    await pickCurrency(shop, "USD");
    await expect(shop.getByText("$14.99").first()).toBeVisible();

    await page.goto("/admin/appearance");
    await expect(page.getByLabel("Your rate for USD")).toHaveValue("100");
    await page.getByLabel("Your rate for USD").fill("");
    await page.getByRole("button", { name: "Save currencies" }).click();
    await expect(page.getByText(/Saved\./)).toBeVisible();
    await shop.reload();
    await expect(shop.getByText("$18.74").first()).toBeVisible();
    await ctx.close();
  });

  test("the currency dropdown opens right under its button as a tidy list and works from the keyboard", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/products");
    const button = page.getByRole("button", { name: "Currency" });
    await button.click();
    const list = page.getByRole("listbox", { name: "Currency choices" });
    await expect(list).toBeVisible();
    await expect(list.getByRole("option")).toHaveCount(3);
    const b = (await button.boundingBox())!;
    const l = (await list.boundingBox())!;
    expect(l.y).toBeGreaterThanOrEqual(b.y + b.height);
    expect(l.y - (b.y + b.height)).toBeLessThan(16);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(list).toHaveCount(0);
    await expect(button).toContainText(/USD|EUR/);
    await button.click();
    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);
    await expect(button).toBeFocused();
    await ctx.close();
  });

  test("a default currency is what a new visitor sees first", async ({ browser, request }) => {
    expect((await put(request, { currencyDefault: "EUR" })).ok()).toBeTruthy();
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/products");
    await expect(page.getByRole("button", { name: "Currency" })).toContainText("EUR");
    await expect(page.getByText("€17.24").first()).toBeVisible();
    await ctx.close();
  });

  test("turning the currencies off removes the switcher and the rupee returns", async ({ browser, request }) => {
    expect((await put(request, { currencyCodes: [], currencyDefault: "INR" })).ok()).toBeTruthy();
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await ctx.addCookies([{ name: "dmg-currency", value: "USD", url: WEB }]);
    await page.goto("/products");
    await expect(page.getByRole("button", { name: "Currency" })).toHaveCount(0);
    await expect(page.getByText("₹1,499").first()).toBeVisible();
    await ctx.close();
  });
});
