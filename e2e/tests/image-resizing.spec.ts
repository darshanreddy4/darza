import { expect, test, type Page } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

// A big, noisy photo-like JPEG made in the browser (the tests have no image library).
async function bigJpeg(page: Page, size = 2400) {
  const b64 = await page.evaluate(async (n) => {
    const c = document.createElement("canvas");
    c.width = n; c.height = n;
    const ctx = c.getContext("2d")!;
    for (let y = 0; y < n; y += 8) for (let x = 0; x < n; x += 8) { ctx.fillStyle = `rgb(${(x * 7 + y * 3) % 256},${Math.floor(Math.random() * 256)},${(y * 5) % 256})`; ctx.fillRect(x, y, 8, 8); }
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.85));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, size);
  return Buffer.from(b64, "base64");
}

test.describe.serial("automatic image resizing", () => {
  let original: Buffer;
  let name = "";
  let productId = "";
  let categoryId = "";

  test.beforeAll(async ({ browser, playwright }) => {
    const ctx = await browser.newContext({ storageState: AUTH_FILES.admin });
    const page = await ctx.newPage();
    await page.goto("/");
    original = await bigJpeg(page);
    await ctx.close();
    expect(original.length).toBeGreaterThan(300_000);
    expect(original.length).toBeLessThan(5 * 1024 * 1024);

    const api = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    const up = await api.post(`${API}/admin/uploads`, { multipart: { file: { name: "big.jpg", mimeType: "image/jpeg", buffer: original } }, headers: asBrowser });
    expect(up.ok(), await up.text()).toBeTruthy();
    name = ((await up.json()) as { url: string }).url.replace("/uploads/", "");
    const cat = await (await api.post(`${API}/admin/categories`, { data: { name: "E2E Pictures", slug: "e2e-pictures" }, headers: asBrowser })).json();
    categoryId = cat.id;
    const prod = await api.post(`${API}/admin/products`, { data: { name: "E2E Big Photo Lamp", slug: "e2e-big-photo-lamp", description: "Has a large uploaded picture.", categoryId, productType: "OWN", status: "PUBLISHED", pricePaise: 49900, sku: "E2E-BIGPHOTO", stock: 9, images: [{ url: `/uploads/${name}` }] }, headers: asBrowser });
    expect(prod.ok(), await prod.text()).toBeTruthy();
    productId = (await prod.json()).id;
    await api.dispose();
  });

  test.afterAll(async ({ playwright }) => {
    const api = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    await api.delete(`${API}/admin/products/${productId}`, { headers: asBrowser });
    await api.delete(`${API}/admin/categories/${categoryId}`, { headers: asBrowser });
    await api.dispose();
  });

  test("a requested size is a small WebP that browsers may keep for a year", async ({ request }) => {
    const small = await request.get(`${API}/img/${name}?w=320`);
    expect(small.status()).toBe(200);
    expect(small.headers()["content-type"]).toBe("image/webp");
    expect(small.headers()["cache-control"]).toContain("immutable");
    const smallBytes = (await small.body()).length;
    expect(smallBytes).toBeLessThan(original.length / 8);

    const again = await request.get(`${API}/img/${name}?w=320`);
    expect((await again.body()).length).toBe(smallBytes);

    const snapped = await request.get(`${API}/img/${name}?w=700`);
    const snappedBytes = (await snapped.body()).length;
    expect(snappedBytes).toBeGreaterThan(smallBytes);
    expect(snappedBytes).toBeLessThan(original.length / 2);
    expect((await (await request.get(`${API}/img/${name}`)).body()).length).toBe(snappedBytes);
  });

  test("only our own uploaded pictures can be asked for", async ({ request }) => {
    expect((await request.get(`${API}/img/..%2F..%2Fetc%2Fpasswd?w=320`)).status()).toBe(404);
    expect((await request.get(`${API}/img/photo.jpg`)).status()).toBe(404);
    expect((await request.get(`${API}/img/${"a".repeat(32)}.jpg?w=320`)).status()).toBe(404);
    const gif = await request.get(`${API}/img/${"b".repeat(32)}.gif`, { maxRedirects: 0 });
    expect(gif.status()).toBe(302);
    expect(gif.headers().location).toBe(`/uploads/${"b".repeat(32)}.gif`);
  });

  test("the product page and listings ask for sized copies", async ({ page }) => {
    await page.goto("/products/e2e-big-photo-lamp");
    const main = page.locator("img[fetchpriority=high]").first();
    await expect(main).toHaveAttribute("srcset", /\/img\/[a-f0-9]{32}\.jpg\?w=480 480w/);
    await expect(main).toHaveAttribute("srcset", /w=1280 1280w/);
    await expect.poll(async () => main.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
    const natural = await main.evaluate((el: HTMLImageElement) => ({ w: el.naturalWidth, src: el.currentSrc }));
    expect(natural.src).toContain("/img/");
    expect(natural.w).toBeLessThanOrEqual(1280);

    await page.goto("/products?q=Big+Photo");
    const card = page.locator("img[srcset]").first();
    await expect(card).toHaveAttribute("srcset", /\/img\/.*w=320 320w/);
    await expect(card).toHaveAttribute("loading", "lazy");
  });

  test("remote product images are left exactly as they are", async ({ page }) => {
    await page.goto("/products/e2e-power-bank");
    const img = page.locator("img[fetchpriority=high]").first();
    await expect(img).toHaveAttribute("src", /^https:\/\//);
    await expect(img).not.toHaveAttribute("srcset", /./);
  });
});
