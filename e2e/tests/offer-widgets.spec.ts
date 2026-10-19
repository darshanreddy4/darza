import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { API, AUTH_FILES, WEB } from "./data";
import { asBrowser } from "./helpers";

test.use({ storageState: AUTH_FILES.admin, viewport: { width: 1280, height: 900 } });

const signedOut = { cookies: [], origins: [] };
const img = (n: string) => `/uploads/e2e-${n}.png`;
const publish = (request: APIRequestContext, widgets: object[]) => request.put(`${API}/admin/home-layout`, { data: { widgets }, headers: asBrowser });

const ICONS = { type: "icon-grid", config: { title: "Shop by icons", columns: 7, accent: "purple", items: [
  { imageUrl: img("skin"), title: "Skincare", linkUrl: "/products?category=skincare" }, { imageUrl: img("hair"), title: "Hair care", linkUrl: "" }, { imageUrl: img("make"), title: "Makeup", linkUrl: "https://example.com/makeup" },
] } };
const BRANDS = { type: "brand-cards", config: { title: "Big beauty brands", columns: 2, background: "sky", items: [
  { logoUrl: img("plum"), headline: "Up to 35% Off", imageUrl: img("plum-p"), linkUrl: "/products?category=plum" }, { logoUrl: img("riya"), headline: "From ₹129", imageUrl: "", linkUrl: "" },
] } };
const BANNER = { type: "image-banner", config: { title: "Brand in spotlight", imageUrl: img("spot"), mobileImageUrl: img("spot-m"), alt: "Fragrance for men, minimum 60% off", linkUrl: "/products?type=OWN", badge: "AD", ratio: "wide" } };
const OFFERS = { type: "offer-cards", config: {
  title: "New deals every day", subtitle: "Fresh every morning", layout: "slider", perView: 3, shape: "square", imageFit: "contain", captionStyle: "below", strip: "gold", cardBackground: "cream", theme: "gold",
  headerImageUrl: img("header"), headerAlt: "Festive deals header",
  items: [1, 2, 3, 4, 5].map((n) => ({ imageUrl: img(`deal-${n}`), label: `Under ₹${n}79`, title: `Deal ${n}`, badge: n === 1 ? "AD" : "", linkUrl: n === 2 ? "/products" : "" })),
} };

test.describe.serial("offer and promo widgets", () => {
  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    await ctx.delete(`${API}/admin/home-layout`, { headers: asBrowser });
    await ctx.put(`${API}/admin/appearance`, { data: { theme: "DEFAULT" }, headers: asBrowser });
    await ctx.dispose();
  });

  test("what an admin saves is cleaned and checked", async ({ request }) => {
    const res = await publish(request, [
      { type: "icon-grid", config: { columns: 40, items: [{ title: "no picture" }, { imageUrl: img("a"), title: "Ok" }] } },
      { type: "offer-cards", config: { theme: "rainbow", perView: 99, items: [{ label: "no picture" }, { imageUrl: img("b") }] } },
    ]);
    expect(res.ok()).toBeTruthy();
    const [grid, offers] = (await res.json()).widgets as { config: Record<string, unknown> }[];
    expect(grid.config.columns).toBe(10);
    expect((grid.config.items as unknown[]).length).toBe(1);
    expect(offers.config).toMatchObject({ theme: "none", perView: 6 });
    expect((offers.config.items as unknown[]).length).toBe(1);

    expect((await publish(request, [{ type: "image-banner", config: {} }])).status()).toBe(400);
    expect((await publish(request, [{ type: "offer-cards", config: { items: [{ imageUrl: img("c"), linkUrl: "javascript:alert(1)" }] } }])).status()).toBe(400);
    expect((await publish(request, [{ type: "brand-cards", config: { items: [{ headline: "x", logoUrl: "http://x.test/l.png" }] } }])).status()).toBe(400);
  });

  test("the icon grid shows a labelled picture button for every icon", async ({ browser, request }) => {
    expect((await publish(request, [ICONS])).ok()).toBeTruthy();
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Shop by icons" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Skincare" })).toHaveAttribute("href", "/products?category=skincare");
    await expect(page.getByRole("link", { name: "Makeup" })).toHaveAttribute("rel", /noopener/);
    await expect(page.getByText("Hair care")).toBeVisible();
    await expect(page.getByRole("link", { name: "Hair care" })).toHaveCount(0);
    await expect(page.locator("ul.lg\\:grid-cols-7")).toBeVisible();
    await ctx.close();
  });

  test("icon grid sizes and shapes change how big and what shape the icons are", async ({ browser, request }) => {
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut, viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    const box = async () => (await page.locator("ul li a span").first().boundingBox())!;
    for (const [size, shape, w, h] of [["xsmall", "rounded", 72, 72], ["medium", "wide", 132, 99], ["small", "tall", 96, 128], ["large", "circle", 180, 180]] as const) {
      expect((await publish(request, [{ ...ICONS, config: { ...ICONS.config, columns: 4, size, shape } }])).ok()).toBeTruthy();
      await page.goto("/");
      const b = await box();
      expect(Math.round(b.width), `${size} ${shape} width`).toBe(w);
      expect(Math.round(b.height), `${size} ${shape} height`).toBe(h);
    }
    expect((await publish(request, [{ ...ICONS, config: { ...ICONS.config, size: "huge", shape: "hexagon" } }])).ok()).toBeTruthy();
    await ctx.close();
  });

  test("brand promo cards show the logo tab, the headline and link where set", async ({ browser, request }) => {
    expect((await publish(request, [BRANDS])).ok()).toBeTruthy();
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Big beauty brands" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Up to 35% Off/ })).toHaveAttribute("href", "/products?category=plum");
    await expect(page.getByText("From ₹129")).toBeVisible();
    await expect(page.getByRole("link", { name: /From ₹129/ })).toHaveCount(0);
    expect(await page.locator("section img").count()).toBeGreaterThanOrEqual(3);
    await ctx.close();
  });

  test("a wide banner links, carries its tag and swaps the picture on phones", async ({ browser, request }) => {
    expect((await publish(request, [BANNER])).ok()).toBeTruthy();
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Brand in spotlight" })).toBeVisible();
    const link = page.getByRole("link", { name: "Fragrance for men, minimum 60% off" });
    await expect(link).toHaveAttribute("href", "/products?type=OWN");
    await expect(link.getByText("AD", { exact: true })).toBeVisible();
    await expect(link.locator("source")).toHaveAttribute("media", "(max-width: 639px)");
    await ctx.close();
  });

  test("offer cards: header picture, strip labels, captions, tags and a slider with arrows", async ({ browser, request }) => {
    expect((await publish(request, [OFFERS])).ok()).toBeTruthy();
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByRole("img", { name: "Festive deals header" })).toBeVisible();
    const pic = await page.getByRole("img", { name: "Festive deals header" }).boundingBox();
    const row = await page.getByRole("heading", { name: "New deals every day" }).locator("..").boundingBox();
    expect(Math.abs(pic!.x - row!.x)).toBeLessThan(1);
    expect(Math.abs(pic!.width - row!.width)).toBeLessThan(1);
    await expect(page.getByRole("heading", { name: "New deals every day" })).toBeVisible();
    await expect(page.getByText("Under ₹179")).toBeInViewport();
    await expect(page.getByText("Deal 1")).toBeVisible();
    await expect(page.getByText("AD", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Deal 2/ })).toHaveAttribute("href", "/products");
    await expect(page.getByText("Under ₹479")).not.toBeInViewport();
    await expect(page.getByRole("button", { name: "Previous New deals every day" })).toBeDisabled();
    await page.getByRole("button", { name: "Next New deals every day" }).click();
    await expect(page.getByText("Under ₹479")).toBeInViewport();
    await ctx.close();
  });

  test("offer cards can be a grid with captions on the picture and no strip", async ({ browser, request }) => {
    const cfg = { ...OFFERS.config, layout: "grid", perView: 3, captionStyle: "overlay", strip: "none", theme: "purple", headerImageUrl: "", items: OFFERS.config.items.slice(0, 3) };
    expect((await publish(request, [{ type: "offer-cards", config: cfg }])).ok()).toBeTruthy();
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByText("Under ₹179 · Deal 1")).toBeVisible();
    await expect(page.getByRole("button", { name: /Next New deals/ })).toHaveCount(0);
    await ctx.close();
  });

  test("a picture can sit behind the cards, with a tint and a text colour", async ({ browser, request }) => {
    const cfg = { ...OFFERS.config, theme: "none", headerImageUrl: "", panelImageUrl: img("panel"), panelOverlay: "dark", panelText: "auto" };
    expect((await publish(request, [{ type: "offer-cards", config: cfg }])).ok()).toBeTruthy();
    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    const heading = page.getByRole("heading", { name: "New deals every day" });
    const panel = heading.locator("xpath=ancestor::div[contains(@class,'rounded-3xl')][1]");
    await expect(panel.locator('img[src*="e2e-panel"]')).toHaveCount(1);
    await expect(panel.locator('img[src*="e2e-panel"]')).toHaveAttribute("alt", "");
    await expect(heading).toHaveCSS("color", "rgb(255, 255, 255)");

    expect((await publish(request, [{ type: "offer-cards", config: { ...cfg, panelText: "dark", panelOverlay: "light" } }])).ok()).toBeTruthy();
    await page.reload();
    await expect(heading).toHaveCSS("color", "rgb(11, 18, 32)");
    expect((await publish(request, [{ type: "offer-cards", config: { ...cfg, panelImageUrl: "http://x.test/p.png" } }])).status()).toBe(400);
    await ctx.close();
  });

  test("the four widgets can be added and set up from the admin portal", async ({ page, browser, request }) => {
    await request.delete(`${API}/admin/home-layout`, { headers: asBrowser });
    await page.goto("/admin/home");
    // The banner needs a picture before it can be saved, so here it is only checked to be on offer.
    await page.getByRole("button", { name: "+ Add widget" }).click();
    await expect(page.getByRole("button", { name: /^Wide image banner/ })).toBeVisible();
    for (const name of [/^Icon grid/, /^Brand promo cards/]) {
      await page.getByRole("button", { name }).click();
      if (String(name).includes("Icon")) {
        const sizeMenu = page.getByRole("button", { name: /^Icon size/ });
        const shapeMenu = page.getByRole("button", { name: /^Shape/ });
        await expect(sizeMenu).toContainText("Large - 180 × 180 px (upload 360 × 360 px)");
        await shapeMenu.click();
        await page.getByRole("option", { name: "Wide rectangle (4:3)" }).click();
        await expect(sizeMenu).toContainText("Large - 180 × 135 px (upload 360 × 270 px)");
        await sizeMenu.click();
        for (const label of ["Extra small - 72 × 54 px (upload 144 × 108 px)", "Small - 96 × 72 px (upload 192 × 144 px)", "Medium - 132 × 99 px (upload 264 × 198 px)"]) {
          await expect(page.getByRole("option", { name: label })).toBeVisible();
        }
        await page.getByRole("option", { name: /^Medium/ }).click();
        await expect(sizeMenu).toContainText("Medium - 132 × 99 px");
      }
      await page.getByRole("button", { name: "+ Add widget" }).click();
    }
    await page.getByRole("button", { name: /^Offer cards/ }).click();
    await expect(page.getByText("Panel picture", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Tint over the picture")).toBeVisible();
    await expect(page.getByLabel("Text colour on the panel")).toBeVisible();
    await expect(page.getByText(/^0 icons · 6 per row/)).toBeVisible();

    // The widget added last (Offer cards) is the one open for editing.
    await page.getByRole("button", { name: "+ Add a card" }).click();
    await page.getByPlaceholder("or paste an https:// image address").last().fill("https://example.com/deal.png");
    await page.getByLabel("Label (strip)").fill("Under ₹279");
    await page.getByLabel("Caption", { exact: true }).fill("Primer");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved. Your home page is updated.")).toBeVisible();
    await expect(page.getByText(/“New deals every day” · 1 card · slider/)).toBeVisible();

    const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
    const shop = await ctx.newPage();
    await shop.goto("/");
    await expect(shop.getByText("Under ₹279")).toBeVisible();
    await expect(shop.getByText("Primer")).toBeVisible();
    await ctx.close();
  });

  test("all four widgets are accessible in every store look", async ({ browser, request }) => {
    test.setTimeout(180_000);
    expect((await publish(request, [ICONS, BRANDS, BANNER, OFFERS, { ...OFFERS, config: { ...OFFERS.config, theme: "purple", strip: "purple", headerImageUrl: "" } }])).ok()).toBeTruthy();
    for (const theme of ["DEFAULT", "MINIMAL", "MAXIMAL", "GLASS", "NEUMORPHIC", "FLAT", "MATERIAL", "EDITORIAL"]) {
      expect((await request.put(`${API}/admin/appearance`, { data: { theme }, headers: asBrowser })).ok()).toBeTruthy();
      const ctx = await browser.newContext({ baseURL: WEB, storageState: signedOut });
      const page = await ctx.newPage();
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Shop by icons" })).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const problems = results.violations.map((v) => `${v.id} x${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => `${n.target.join(" ")} ${(n.any[0]?.message ?? "").slice(0, 160)}`).join(" | ")}`);
      expect(problems, theme).toEqual([]);
      await ctx.close();
    }
  });
});
