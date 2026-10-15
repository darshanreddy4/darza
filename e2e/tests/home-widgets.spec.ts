import { expect, test, type Page } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const y = async (page: Page, text: string) => (await page.getByRole("heading", { name: text, exact: true }).first().boundingBox())!.y;

test.describe.serial("home page builder", () => {
  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    await ctx.delete(`${API}/admin/home-layout`, { headers: asBrowser });
    await ctx.dispose();
  });

  test("the original layout is what visitors see before anything is changed", async ({ page }) => {
    await page.goto("/");
    for (const h of ["Shop by category", "Featured", "Sold by DMG", "Partner picks"]) await expect(page.getByRole("heading", { name: h, exact: true })).toBeVisible();
    await page.goto("/admin/home");
    await expect(page.getByText("You are using the original layout")).toBeVisible();
    await expect(page.getByRole("button", { name: "Saved" })).toBeDisabled();
  });

  test("add a text widget in the middle, a promo strip and a hand-picked collection, then save", async ({ page }) => {
    await page.goto("/admin/home");

    // Straight after the banner slider.
    await page.getByRole("button", { name: "Add below" }).first().click();
    await page.getByRole("button", { name: /^Text block/ }).click();
    await page.getByLabel("Heading", { exact: true }).fill("E2E announcement");
    await page.locator("textarea").first().fill("Free gift wrapping this week.");

    await page.getByRole("button", { name: "+ Add widget" }).click();
    await page.getByRole("button", { name: /^Promo strip/ }).click();
    await page.getByLabel("Headline", { exact: true }).fill("E2E festival sale");
    await page.getByLabel("Button label", { exact: true }).fill("Shop the sale");
    await page.getByLabel(/^Link/).fill("/products?type=OWN");

    await page.getByRole("button", { name: "+ Add widget" }).click();
    await page.getByRole("button", { name: /^Product collection/ }).click();
    await page.getByLabel("Heading", { exact: true }).fill("E2E hand-picked");
    await page.getByLabel("Which products").selectOption("picks");
    await page.getByPlaceholder("Search published products by name…").fill("power bank");
    await page.getByRole("button", { name: /E2E Power Bank 10000mAh/ }).click();

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved. Your home page is updated.")).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "E2E announcement" })).toBeVisible();
    await expect(page.getByText("Free gift wrapping this week.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Shop the sale" })).toHaveAttribute("href", "/products?type=OWN");
    const picked = page.locator("section").filter({ has: page.getByRole("heading", { name: "E2E hand-picked" }) });
    await expect(picked.getByText("E2E Power Bank 10000mAh")).toBeVisible();
    await expect(picked.getByText("E2E USB-C Cable")).toHaveCount(0);

    // The announcement sits above the category tiles; the new collection is last.
    expect(await y(page, "E2E announcement")).toBeLessThan(await y(page, "Shop by category"));
    expect(await y(page, "E2E hand-picked")).toBeGreaterThan(await y(page, "Partner picks"));
  });

  test("the layout survives a reload of the admin page, and a widget can be hidden", async ({ page }) => {
    await page.goto("/admin/home");
    await expect(page.getByText("You are using the original layout")).toHaveCount(0);
    await page.getByLabel(/^Show Product collection \d+$/).last().uncheck();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved. Your home page is updated.")).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "E2E hand-picked" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Featured", exact: true })).toBeVisible();
  });

  test("a bad link is refused with a clear message and nothing is saved", async ({ page, request }) => {
    const res = await request.put(`${API}/admin/home-layout`, { data: { widgets: [{ type: "promo-banner", config: { title: "x", linkUrl: "javascript:alert(1)" } }] }, headers: asBrowser });
    expect(res.status()).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("Link must be");

    const empty = await request.put(`${API}/admin/home-layout`, { data: { widgets: [] }, headers: asBrowser });
    expect(empty.status()).toBe(400);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "E2E announcement" })).toBeVisible();
  });

  test("only admins can read or change the layout", async ({ browser }) => {
    const customer = await browser.newContext({ storageState: AUTH_FILES.customer });
    expect((await customer.request.get(`${API}/admin/home-layout`, { headers: asBrowser })).status()).toBe(403);
    expect((await customer.request.put(`${API}/admin/home-layout`, { data: { widgets: [{ type: "spacer" }] }, headers: asBrowser })).status()).toBe(403);
    await customer.close();
  });

  test("resetting brings the original page back", async ({ page }) => {
    await page.goto("/admin/home");
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Reset to original" }).click();
    await expect(page.getByText("The home page is back to the original layout.")).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "E2E announcement" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Partner picks", exact: true })).toBeVisible();
  });
});
