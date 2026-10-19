import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { API, AUTH_FILES, WEB } from "./data";
import { asBrowser } from "./helpers";

test.use({ storageState: AUTH_FILES.admin, viewport: { width: 1366, height: 900 } });

const json = { ...asBrowser, "content-type": "application/json" };
const signedOut = { cookies: [], origins: [] };
// A 1x1 PNG, enough for an upload.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const css = (page: Page, selector: string, prop: string) => page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

test.describe.serial("header, search bar, category bar and footer colours", () => {
  const put = (request: import("@playwright/test").APIRequestContext, body: Record<string, unknown>) => request.put(`${API}/admin/appearance`, { data: body, headers: json });

  test.afterAll(async ({ request }) => {
    await put(request, { chrome: {}, theme: "DEFAULT" });
  });

  test("the saved colours are cleaned up, and anything unsafe is refused", async ({ request }) => {
    const ok = await put(request, { chrome: { header: { bg: "#1E3A8A", fg: "#FFF" }, search: { button: "#7c3aed" }, footer: { bg: "#111" }, nav: { bg: "" } } });
    expect(ok.ok(), await ok.text()).toBeTruthy();
    const shown = (await (await request.get(`${API}/appearance`)).json()) as { chrome: Record<string, Record<string, string>> };
    expect(shown.chrome).toEqual({ header: { bg: "#1e3a8a", fg: "#ffffff" }, search: { button: "#7c3aed" }, footer: { bg: "#111111" } });

    for (const bad of [{ header: { bg: "red;}" } }, { footer: { image: "javascript:alert(1)" } }, { header: { image: 'https://x.com/a.png");}' } }, { header: { image: "https://x.com/a.png", overlay: 120 } }, { search: { bg: "#12" } }]) {
      const res = await put(request, { chrome: bad });
      expect(res.status(), JSON.stringify(bad)).toBe(400);
    }
    // Nothing from the refused attempts was saved.
    expect(((await (await request.get(`${API}/appearance`)).json()) as { chrome: unknown }).chrome).toEqual(shown.chrome);

    expect((await put(request, { chrome: {} })).ok()).toBeTruthy();
    expect(((await (await request.get(`${API}/appearance`)).json()) as { chrome: unknown }).chrome).toEqual({});
  });

  test("a header colour is used, with text that is readable on it", async ({ browser, request }) => {
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    expect(await css(page, 'header [data-chrome="bar"]', "background-color")).toBe("rgb(11, 18, 32)");

    await put(request, { chrome: { header: { bg: "#1e3a8a" } } });
    await page.goto("/");
    expect(await css(page, 'header [data-chrome="bar"]', "background-color")).toBe("rgb(30, 58, 138)");
    expect(await css(page, 'header a[href="/login"]', "color")).toBe("rgba(255, 255, 255, 0.75)");

    // A light colour gets dark text by itself.
    await put(request, { chrome: { header: { bg: "#fde68a" } } });
    await page.goto("/");
    expect(await css(page, 'header [data-chrome="bar"]', "background-color")).toBe("rgb(253, 230, 138)");
    expect(await css(page, 'header a[href="/login"]', "color")).toBe("rgba(11, 18, 32, 0.75)");

    // And the admin can choose the text colour too.
    await put(request, { chrome: { header: { bg: "#fde68a", fg: "#7c2d12" } } });
    await page.goto("/");
    expect(await css(page, 'header a[href="/login"]', "color")).toMatch(/^rgba\(124, 45, 18, 0\.\d+\)$/);
    await ctx.close();
  });

  test("the search bar, category bar and footer take their own colours", async ({ browser, request }) => {
    await put(request, { chrome: { search: { bg: "#ffe4e6", button: "#7c3aed" }, nav: { bg: "#064e3b" }, footer: { bg: "#7c2d12" } } });
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    expect(await css(page, 'header [role="search"]', "background-color")).toBe("rgb(255, 228, 230)");
    expect(await css(page, 'header [role="search"] button[aria-label="Search"]', "background-color")).toBe("rgb(124, 58, 237)");
    expect(await css(page, 'header [role="search"] button[aria-label="Search"]', "color")).toBe("rgb(255, 255, 255)");
    expect(await css(page, 'header nav[aria-label="Categories"]', "background-color").catch(() => "")).not.toBe("");
    expect(await css(page, 'header [data-custom-nav]', "background-color")).toBe("rgb(6, 78, 59)");
    expect(await css(page, 'header a[href="/products"]', "color")).toBe("rgb(255, 255, 255)");
    expect(await css(page, "footer", "background-color")).toBe("rgb(124, 45, 18)");
    expect(await css(page, "footer h2", "color")).toBe("rgb(255, 255, 255)");
    // The suggestions list stays white and readable.
    await page.getByRole("combobox").fill("po");
    await expect(page.getByRole("listbox", { name: "Suggestions" })).toBeVisible();
    expect(await css(page, '[role="listbox"]', "color")).not.toBe("rgb(255, 255, 255)");
    await ctx.close();
  });

  test("a picture can go behind the header and footer, under a tint of their colour", async ({ browser, request }) => {
    const up = await request.post(`${API}/admin/uploads`, { multipart: { file: { name: "bg.png", mimeType: "image/png", buffer: PNG } }, headers: asBrowser });
    expect(up.ok(), await up.text()).toBeTruthy();
    const { url } = (await up.json()) as { url: string };
    expect(url).toMatch(/^\/uploads\//);
    const saved = await put(request, { chrome: { header: { bg: "#0b1220", image: url, overlay: 60 }, footer: { image: url } } });
    expect(saved.ok(), await saved.text()).toBeTruthy();

    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    const header = await css(page, 'header [data-chrome="bar"]', "background-image");
    expect(header).toContain("linear-gradient");
    expect(header).toContain("/uploads/");
    expect(header).toContain("rgba(11, 18, 32, 0.6)");
    expect(await css(page, 'header [data-chrome="bar"]', "background-size")).toContain("cover");
    expect(await css(page, "footer", "background-image")).toContain("/uploads/");
    await ctx.close();
  });

  test("a store look and custom colours work together", async ({ browser, request }) => {
    await put(request, { theme: "MINIMAL", chrome: { header: { bg: "#064e3b" }, footer: { bg: "#064e3b" } } });
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    expect(await css(page, 'header [data-chrome="bar"]', "background-color")).toBe("rgb(6, 78, 59)");
    expect(await css(page, "footer", "background-color")).toBe("rgb(6, 78, 59)");
    expect(await css(page, 'header a[href="/login"]', "color")).toBe("rgba(255, 255, 255, 0.75)");
    expect(await css(page, "footer h2", "color")).toBe("rgb(255, 255, 255)");
    await put(request, { theme: "DEFAULT", chrome: {} });
    await ctx.close();
  });

  test("the pages stay accessible with dark and light colours", async ({ browser, request }) => {
    const scan = async (page: Page) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      return r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    };
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    for (const bg of ["#1e3a8a", "#fde68a", "#7c3aed", "#ffffff", "#111111"]) {
      await put(request, { chrome: { header: { bg }, search: { bg }, nav: { bg }, footer: { bg } } });
      expect(await scan(page), bg).toEqual([]);
    }
    await ctx.close();
  });

  test("the admin picks colours on the Appearance page, sees a preview and a warning, and can go back", async ({ page, request }) => {
    await put(request, { chrome: {} });
    await page.goto("/admin/appearance");
    const bg = page.getByLabel("Header background colour", { exact: true });
    await bg.fill("#0f766e");
    await page.getByLabel("Footer background colour", { exact: true }).fill("#7c2d12");
    await page.getByLabel("Search bar button colour", { exact: true }).fill("#7c3aed");

    // Hard-to-read pairs are flagged before saving.
    await page.getByLabel("Header text colour", { exact: true }).fill("#14b8a6");
    await expect(page.getByRole("status").filter({ hasText: "hard to read" })).toContainText("Header");
    await page.getByLabel("Header text colour", { exact: true }).fill("");
    await expect(page.getByRole("status").filter({ hasText: "hard to read" })).toHaveCount(0);

    await bg.fill("0f766e");
    await expect(page.getByText("Use a colour like #1e3a8a.")).toBeVisible();
    await page.getByRole("button", { name: "Save colours" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "use a colour like #1e3a8a" })).toBeVisible();
    await bg.fill("#0f766e");
    await page.getByRole("button", { name: "Save colours" }).click();
    await expect(page.getByText("Saved. The header, search bar and footer now use these colours.")).toBeVisible();

    const shown = (await (await request.get(`${API}/appearance`)).json()) as { chrome: Record<string, Record<string, string>> };
    expect(shown.chrome).toEqual({ header: { bg: "#0f766e" }, search: { button: "#7c3aed" }, footer: { bg: "#7c2d12" } });

    const shop = await page.context().browser()!.newContext({ baseURL: WEB, storageState: signedOut });
    const sp = await shop.newPage();
    await sp.goto("/");
    expect(await css(sp, 'header [data-chrome="bar"]', "background-color")).toBe("rgb(15, 118, 110)");
    expect(await css(sp, "footer", "background-color")).toBe("rgb(124, 45, 18)");

    await page.getByRole("button", { name: "Back to standard colours" }).click();
    await expect(page.getByText("Back to the standard colours.")).toBeVisible();
    await sp.goto("/");
    expect(await css(sp, 'header [data-chrome="bar"]', "background-color")).toBe("rgb(11, 18, 32)");
    expect(await css(sp, "footer", "background-color")).toBe("rgb(11, 18, 32)");
    await shop.close();
  });

  test("a picture is chosen with the image field and a tint slider appears", async ({ page, request }) => {
    await put(request, { chrome: {} });
    await page.goto("/admin/appearance");
    const header = page.getByRole("group", { name: "Header" });
    await header.locator('input[type="file"]').setInputFiles({ name: "header.png", mimeType: "image/png", buffer: PNG });
    await expect(header.getByRole("slider", { name: "Header picture tint" })).toBeVisible();
    await header.getByRole("slider", { name: "Header picture tint" }).fill("70");
    await page.getByRole("button", { name: "Save colours" }).click();
    await expect(page.getByText("Saved. The header, search bar and footer now use these colours.")).toBeVisible();
    const shown = (await (await request.get(`${API}/appearance`)).json()) as { chrome: { header?: { image?: string; overlay?: number } } };
    expect(shown.chrome.header?.image).toMatch(/^\/uploads\//);
    expect(shown.chrome.header?.overlay).toBe(70);
  });
});
