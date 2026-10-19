import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { deflateSync, crc32 } from "node:zlib";
import { API, AUTH_FILES, WEB } from "./data";
import { asBrowser } from "./helpers";

test.use({ storageState: AUTH_FILES.admin, viewport: { width: 1280, height: 900 } });

const signedOut = { cookies: [], origins: [] };
const saveBrand = (request: APIRequestContext, data: object) => request.put(`${API}/admin/site-profile`, { data, headers: asBrowser });

// A 16 by 16 PNG: white all round with a solid dark square in the middle that has a white dot in it.
function samplePng() {
  const size = 16;
  const rows: number[] = [];
  for (let y = 0; y < size; y++) {
    rows.push(0);
    for (let x = 0; x < size; x++) {
      const inSquare = x >= 4 && x < 12 && y >= 4 && y < 12;
      const dot = x >= 7 && x < 9 && y >= 7 && y < 9;
      const v = inSquare && !dot ? 20 : 255;
      rows.push(v, v, v, 255);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.from(rows))), chunk("IEND", Buffer.alloc(0))]);
}

async function upload(request: APIRequestContext, png: Buffer) {
  const res = await request.post(`${API}/admin/uploads`, { multipart: { file: { name: "logo.png", mimeType: "image/png", buffer: png } }, headers: asBrowser });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { url: string }).url;
}

// The alpha of one pixel, read by drawing the picture the way a browser would.
async function alphaAt(page: Page, bytes: Buffer, x: number, y: number) {
  return page.evaluate(async ({ b64, x, y }) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width; canvas.height = bmp.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    return ctx.getImageData(x, y, 1, 1).data[3];
  }, { b64: bytes.toString("base64"), x, y });
}

test.describe.serial("designing the logo", () => {
  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    await ctx.put(`${API}/admin/site-profile`, { data: {}, headers: asBrowser });
    await ctx.dispose();
  });

  test("the logo design is checked and handed to the storefront", async ({ request }) => {
    expect((await saveBrand(request, { logoDesign: { font: "comic-sans" } })).status()).toBe(400);
    expect((await saveBrand(request, { logoDesign: { color: "red" } })).status()).toBe(400);
    expect((await saveBrand(request, { logoDesign: { mode: "TEXT", text: "Acme", font: "bebas", colorMode: "SINGLE", color: "#ff0000", effect: "3D" } })).ok()).toBeTruthy();
    const site = (await (await request.get(`${API}/site`)).json()) as { logoDesign: { mode: string; font: string; color: string } };
    expect(site.logoDesign).toMatchObject({ mode: "TEXT", font: "bebas", color: "#ff0000" });
  });

  test("the admin designs a text logo with a colour for every letter and a 3D effect", async ({ page, request }) => {
    expect((await saveBrand(request, {})).ok()).toBeTruthy();
    await page.goto("/admin/brand");
    await page.getByRole("radio", { name: /Text logo/ }).click();
    await page.getByLabel(/^Logo text/).fill("Pixel");
    await page.getByRole("radio", { name: /Pacifico/ }).click();
    await page.getByRole("radio", { name: /Each letter/ }).click();
    await expect(page.getByRole("group", { name: "Colour for each letter" }).locator("input[type=color]")).toHaveCount(5);
    await page.getByLabel(/^Colour for letter P /).fill("#ff0000");
    await page.getByLabel(/^Colour for letter i /).fill("#00aa00");
    await page.getByRole("radio", { name: /^3D/ }).click();
    await page.getByRole("button", { name: "Save changes" }).first().click();
    await expect(page.getByText("Saved. Your storefront now shows these details.")).toBeVisible();

    const ctx = await page.context().browser()!.newContext({ baseURL: WEB, storageState: signedOut });
    const shop = await ctx.newPage();
    await shop.goto("/");
    const logo = shop.locator("header").getByRole("img", { name: "Pixel" });
    await expect(logo).toBeVisible();
    await expect(shop.locator("header img")).toHaveCount(0);
    const first = logo.locator("span").nth(0);
    await expect(first).toHaveText("P");
    await expect(first).toHaveCSS("color", "rgb(255, 0, 0)");
    await expect(logo.locator("span").nth(1)).toHaveCSS("color", "rgb(0, 170, 0)");
    expect(await first.evaluate((el) => getComputedStyle(el).textShadow)).not.toBe("none");
    expect(await logo.evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Pacifico");
    expect(await logo.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
    await shop.goto("/about");
    await expect(shop.getByRole("img", { name: "Pixel" }).first()).toBeVisible();
    await ctx.close();
  });

  test("a text logo that matches the page is light on the dark header and dark on light pages", async ({ page, request }) => {
    expect((await saveBrand(request, { logoDesign: { mode: "TEXT", text: "Plain", colorMode: "AUTO" } })).ok()).toBeTruthy();
    const ctx = await page.context().browser()!.newContext({ baseURL: WEB, storageState: signedOut });
    const shop = await ctx.newPage();
    await shop.goto("/");
    await expect(shop.locator("header").getByText("Plain", { exact: true })).toHaveCSS("color", "rgb(255, 255, 255)");
    await shop.goto("/about");
    await expect(shop.getByRole("main").getByText("Plain", { exact: true }).first()).toHaveCSS("color", "rgb(11, 18, 32)");
    await ctx.close();
  });

  test("a gradient wordmark paints through the letters", async ({ page, request }) => {
    expect((await saveBrand(request, { logoDesign: { mode: "TEXT", text: "Blend", colorMode: "GRADIENT", gradient: ["#ff0000", "#0000ff"], effect: "GLOW" } })).ok()).toBeTruthy();
    const ctx = await page.context().browser()!.newContext({ baseURL: WEB, storageState: signedOut });
    const shop = await ctx.newPage();
    await shop.goto("/");
    const word = shop.locator("header").getByText("Blend", { exact: true });
    expect(await word.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("linear-gradient");
    expect(await word.evaluate((el) => getComputedStyle(el).filter)).toContain("drop-shadow");
    await ctx.close();
  });

  test("a picture logo can have a 3D effect and keeps its transparent look", async ({ page, request }) => {
    const url = await upload(request, samplePng());
    expect((await saveBrand(request, { logoUrl: url, logoDesign: { mode: "IMAGE", imageEffect: "3D" } })).ok()).toBeTruthy();
    const ctx = await page.context().browser()!.newContext({ baseURL: WEB, storageState: signedOut });
    const shop = await ctx.newPage();
    await shop.goto("/");
    const img = shop.locator("header img").first();
    await expect(img).toBeVisible();
    expect(await img.evaluate((el) => getComputedStyle(el).filter)).toContain("drop-shadow");
    await expect(img.locator("xpath=..")).not.toHaveClass(/bg-white/);
    await ctx.close();
  });

  test("the plain background around an uploaded logo can be made transparent", async ({ page, request }) => {
    const original = samplePng();
    const url = await upload(request, original);
    await page.goto("about:blank");
    expect(await alphaAt(page, original, 0, 0)).toBe(255);

    const res = await request.post(`${API}/admin/site-profile/transparent-logo`, { data: { url, strength: "medium" }, headers: asBrowser });
    expect(res.ok()).toBeTruthy();
    const { url: cleaned } = (await res.json()) as { url: string };
    expect(cleaned).not.toBe(url);
    const bytes = await (await request.get(`${API}${cleaned}`)).body();
    expect(await alphaAt(page, bytes, 0, 0)).toBe(0);
    expect(await alphaAt(page, bytes, 15, 15)).toBe(0);
    expect(await alphaAt(page, bytes, 5, 5)).toBe(255);
    expect(await alphaAt(page, bytes, 7, 7)).toBe(255);
  });

  test("only uploaded logos can be cleaned, and a transparent one has nothing to remove", async ({ request }) => {
    expect((await request.post(`${API}/admin/site-profile/transparent-logo`, { data: { url: "https://example.com/logo.png" }, headers: asBrowser })).status()).toBe(400);
    expect((await request.post(`${API}/admin/site-profile/transparent-logo`, { data: { url: "/uploads/../../etc/passwd" }, headers: asBrowser })).status()).toBe(400);
    const url = await upload(request, samplePng());
    const first = (await (await request.post(`${API}/admin/site-profile/transparent-logo`, { data: { url }, headers: asBrowser })).json()) as { url: string };
    expect((await request.post(`${API}/admin/site-profile/transparent-logo`, { data: { url: first.url }, headers: asBrowser })).status()).toBe(400);
  });

  test("the admin can clean a logo from the designer", async ({ page, request }) => {
    const url = await upload(request, samplePng());
    expect((await saveBrand(request, { logoUrl: url })).ok()).toBeTruthy();
    await page.goto("/admin/brand");
    await page.getByRole("button", { name: "Make background transparent" }).click();
    await expect(page.getByText(/The background is now transparent/)).toBeVisible();
  });

  test("customers cannot change the logo", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH_FILES.customer });
    const res = await ctx.request.put(`${API}/admin/site-profile`, { data: { logoDesign: { mode: "TEXT" } }, headers: asBrowser });
    expect(res.status()).toBe(403);
    expect((await ctx.request.post(`${API}/admin/site-profile/transparent-logo`, { data: { url: "/uploads/x.png" }, headers: asBrowser })).status()).toBe(403);
    await ctx.close();
  });
});
