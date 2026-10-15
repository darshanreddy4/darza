import { expect, test } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser } from "./helpers";

test.use({ storageState: AUTH_FILES.admin, viewport: { width: 1280, height: 900 } });

const LOGO = "https://example.com/e2e-logo.png";

test.describe.serial("brand and contact details", () => {
  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    await ctx.put(`${API}/admin/site-profile`, { data: {}, headers: asBrowser });
    await ctx.dispose();
  });

  test("before anything is set, the store shows its defaults", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "DMG home" })).toBeVisible();
    await expect(page.locator("footer").getByText("Connect with us")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Chat with us on WhatsApp" })).toHaveCount(0);
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "About DMG" })).toBeVisible();
  });

  test("the admin saves the brand, about us, customer care and social links", async ({ page }) => {
    await page.goto("/admin/brand");
    await page.getByLabel("Brand name").fill("E2E Mart");
    await page.getByLabel("Short tagline").fill("Everything for your test shelf.");
    await page.getByPlaceholder("or paste an https:// image address").fill(LOGO);
    await page.getByLabel(/^Show my logo on a white badge/).check();
    await page.locator("textarea").fill("We started E2E Mart to test things.\n\nEvery order is checked twice.");
    await page.getByLabel("Email", { exact: true }).fill("care@e2emart.test");
    await page.getByLabel(/^Phone/).fill("+91 98765 43210");
    await page.getByLabel(/^Address/).fill("1 Test Road, Pune, Maharashtra 411001");
    await page.getByLabel("Opening hours").fill("Mon to Sat, 10 am to 6 pm");
    await page.getByLabel("Note for customers").fill("We reply within one working day.");
    await page.getByLabel(/^WhatsApp number/).fill("+91 98765 43210");
    await page.getByLabel(/^Message customers start with/).fill("Hi, I need help");
    await page.getByLabel(/^Show a floating WhatsApp chat button/).check();
    await page.getByPlaceholder(/^@yourbrand or https:\/\/instagram.com/).fill("@e2emart");
    await page.getByPlaceholder(/^@yourbrand or https:\/\/x.com/).fill("https://x.com/e2emart");
    await page.getByRole("button", { name: "+ Add a link" }).click();
    await page.getByLabel("Other link 1 name").fill("Our blog");
    await page.getByLabel("Other link 1 address").fill("https://blog.e2emart.test");
    await page.getByRole("button", { name: "Save changes" }).first().click();
    await expect(page.getByText("Saved. Your storefront now shows these details.")).toBeVisible();
  });

  test("the logo, name and tagline replace the defaults in the header and footer", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("link", { name: "E2E Mart home" });
    await expect(header.locator("img")).toHaveAttribute("src", LOGO);
    const footer = page.locator("footer");
    await expect(footer.getByText("Everything for your test shelf.")).toBeVisible();
    await expect(footer.getByText("© " + new Date().getFullYear() + " E2E Mart")).toBeVisible();
  });

  test("the footer lists customer care and social links", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer.getByText("Mon to Sat, 10 am to 6 pm")).toBeVisible();
    await expect(footer.getByRole("link", { name: "+91 98765 43210" })).toHaveAttribute("href", "tel:+919876543210");
    await expect(footer.getByRole("link", { name: "care@e2emart.test" })).toHaveAttribute("href", "mailto:care@e2emart.test");
    await expect(footer.getByRole("link", { name: "Chat on WhatsApp" })).toHaveAttribute("href", "https://wa.me/919876543210?text=Hi%2C%20I%20need%20help");
    await expect(footer.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://instagram.com/e2emart");
    await expect(footer.getByRole("link", { name: "X (Twitter)" })).toHaveAttribute("href", "https://x.com/e2emart");
    await expect(footer.getByRole("link", { name: "Our blog" })).toHaveAttribute("href", "https://blog.e2emart.test");
    await expect(footer.getByRole("link", { name: "About us" })).toBeVisible();
  });

  test("a floating WhatsApp button appears on every page", async ({ page }) => {
    for (const path of ["/", "/products", "/privacy"]) {
      await page.goto(path);
      await expect(page.getByRole("link", { name: "Chat with us on WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/919876543210/);
    }
  });

  test("the About us page shows the text, care details and links", async ({ page }) => {
    await page.goto("/about");
    const main = page.locator("main");
    await expect(page.getByRole("heading", { name: "About E2E Mart" })).toBeVisible();
    await expect(main.getByText("We started E2E Mart to test things.")).toBeVisible();
    await expect(main.getByText("Every order is checked twice.")).toBeVisible();
    await expect(main.getByText("1 Test Road, Pune, Maharashtra 411001")).toBeVisible();
    await expect(main.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://instagram.com/e2emart");
    await expect(page).toHaveTitle("About us — E2E Mart");
  });

  test("the contact and legal pages use the saved details", async ({ page }) => {
    await page.goto("/contact");
    const main = page.locator("main");
    await expect(main.getByText("care@e2emart.test").first()).toBeVisible();
    await expect(main.getByText("Mon to Sat, 10 am to 6 pm").first()).toBeVisible();
    await expect(main.getByRole("link", { name: "Instagram" })).toBeVisible();
    await page.goto("/terms");
    await expect(main.getByText(/E2E Mart is operated by/)).toBeVisible();
    await expect(main.getByText(/1 Test Road, Pune/)).toBeVisible();
  });

  test("search engines get the logo, contact point and social profiles", async ({ page, request }) => {
    await page.goto("/");
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const org = blocks.flatMap((b) => [JSON.parse(b)].flat()).find((d) => d["@type"] === "Organization");
    expect(org).toMatchObject({ name: "E2E Mart", logo: LOGO, contactPoint: { email: "care@e2emart.test", telephone: "+91 98765 43210" } });
    expect(org.sameAs).toEqual(expect.arrayContaining(["https://instagram.com/e2emart", "https://x.com/e2emart"]));
    expect(await (await request.get("/sitemap.xml")).text()).toContain("/about");
  });

  test("mistakes are explained and nothing is saved", async ({ page, request }) => {
    await page.goto("/admin/brand");
    await page.getByLabel("Email", { exact: true }).fill("not-an-email");
    await page.getByRole("button", { name: "Save changes" }).first().click();
    await expect(page.getByText("The email address does not look right")).toBeVisible();

    const bad = await request.put(`${API}/admin/site-profile`, { data: { socials: { instagram: "http://instagram.com/x" }, logoUrl: "javascript:alert(1)" }, headers: asBrowser });
    expect(bad.status()).toBe(400);
    const body = JSON.stringify(await bad.json());
    expect(body).toContain("instagram");
    expect(body).toContain("logo");

    await page.goto("/");
    await expect(page.locator("footer").getByRole("link", { name: "care@e2emart.test" })).toBeVisible();
  });

  test("only admins can change the details", async ({ browser }) => {
    const customer = await browser.newContext({ storageState: AUTH_FILES.customer });
    expect((await customer.request.get(`${API}/admin/site-profile`, { headers: asBrowser })).status()).toBe(403);
    expect((await customer.request.put(`${API}/admin/site-profile`, { data: { brandName: "Hacked" }, headers: asBrowser })).status()).toBe(403);
    await customer.close();
    expect((await (await (await import("@playwright/test")).request.newContext()).get(`${API}/site`)).ok()).toBeTruthy();
  });

  test("clearing everything brings the defaults back", async ({ page, request }) => {
    expect((await request.put(`${API}/admin/site-profile`, { data: {}, headers: asBrowser })).ok()).toBeTruthy();
    await page.goto("/");
    await expect(page.getByRole("link", { name: "DMG home" })).toBeVisible();
    await expect(page.locator("footer").getByText("Connect with us")).toHaveCount(0);
  });
});
