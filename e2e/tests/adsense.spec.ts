import { pick } from "./helpers";
import { expect, test, type Page } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const SNIPPET = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456" crossorigin="anonymous"></script>
<!-- Home banner -->
<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-1234567890123456" data-ad-slot="9876543210" data-ad-format="auto" data-full-width-responsive="true"></ins>
<script>window.__adsensePwned = true; (adsbygoogle = window.adsbygoogle || []).push({});</script>`;

async function addAd(page: Page, placement: string, code = SNIPPET) {
  await page.goto("/admin/home");
  await page.getByRole("button", { name: "+ Add widget" }).click();
  await page.getByRole("button", { name: /^Google AdSense ad/ }).click();
  await page.getByLabel("Paste your AdSense ad code").fill(code);
  await pick(page.getByLabel("Where it shows"), placement);
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved. Your home page is updated.")).toBeVisible();
}

test.describe.serial("AdSense widget", () => {
  test.beforeEach(async ({ page }) => {
    // Google's servers are not needed to check that the right tag is placed.
    await page.route("**/pagead2.googlesyndication.com/**", (r) => r.abort());
  });

  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    await ctx.delete(`${API}/admin/home-layout`, { headers: asBrowser });
    await ctx.dispose();
  });

  test("pasting the code reads the ad details and shows them", async ({ page }) => {
    await addAd(page, "inline");
    await expect(page.getByText("Connected: ca-pub-1234567890123456 · slot 9876543210 · auto")).toBeVisible();
  });

  test("code that is not an ad unit is explained, not accepted", async ({ page }) => {
    await addAd(page, "inline", `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456"></script>`);
    await expect(page.getByText(/without an ad unit/)).toBeVisible();
    await expect(page.getByText("No ad connected yet")).toBeVisible();
  });

  test("an inline ad appears where it was placed, and the pasted script is not run", async ({ page }) => {
    await addAd(page, "inline");
    await page.getByLabel(/Test mode/).check();
    await save(page);

    await page.goto("/");
    const ins = page.locator("ins.adsbygoogle");
    await expect(ins).toHaveCount(1);
    await expect(ins).toHaveAttribute("data-ad-client", "ca-pub-1234567890123456");
    await expect(ins).toHaveAttribute("data-ad-slot", "9876543210");
    await expect(ins).toHaveAttribute("data-ad-format", "auto");
    await expect(ins).toHaveAttribute("data-adtest", "on");
    await expect(page.getByText("Advertisement", { exact: true })).toBeVisible();
    // Last widget on the page, after "How shopping works".
    expect(await page.locator("ins.adsbygoogle").boundingBox().then((b) => b!.y)).toBeGreaterThan(await page.getByRole("heading", { name: /Two ways to shop/ }).boundingBox().then((b) => b!.y));
    // Google's loader is added once, from our own code.
    await expect(page.locator('script[src*="adsbygoogle.js?client=ca-pub-1234567890123456"]')).toHaveCount(1);
    expect(await page.evaluate(() => (window as unknown as { __adsensePwned?: boolean }).__adsensePwned)).toBeUndefined();
  });

  test("ads.txt lists the publisher, and the privacy page tells visitors about the ads", async ({ request, page }) => {
    const txt = await request.get("/ads.txt");
    expect(txt.status()).toBe(200);
    expect(await txt.text()).toContain("google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0");
    await page.goto("/privacy");
    await expect(page.getByText("Google (AdSense)")).toBeVisible();
  });

  test("a side ad shows only on wide screens", async ({ page }) => {
    await page.goto("/admin/home");
    await page.getByRole("button", { name: "Edit" }).last().click();
    await pick(page.getByLabel("Where it shows"), "right-rail");
    await save(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
    await page.setViewportSize({ width: 1800, height: 900 });
    await page.goto("/");
    await expect(page.locator("aside[aria-label='Advertisement']")).toBeVisible();
    await expect(page.locator("aside[aria-label='Advertisement'] ins.adsbygoogle")).toHaveCount(1);
  });

  test("a sticky bottom ad can be closed by the visitor", async ({ page }) => {
    await page.goto("/admin/home");
    await page.getByRole("button", { name: "Edit" }).last().click();
    await pick(page.getByLabel("Where it shows"), "bottom-bar");
    await save(page);

    await page.goto("/");
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(1);
    await page.getByRole("button", { name: "Close advertisement" }).click();
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
  });

  test("a hidden ad is not shown and ads.txt goes away with the last ad", async ({ page, request }) => {
    await page.goto("/admin/home");
    await page.getByLabel(/^Show Google AdSense ad \d+$/).uncheck();
    await save(page);
    await page.goto("/");
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
    expect((await request.get("/ads.txt")).status()).toBe(404);
  });
});
