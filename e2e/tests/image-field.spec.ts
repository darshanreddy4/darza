import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { API, AUTH_FILES, WEB } from "./data";
import { asBrowser } from "./helpers";

test.use({ storageState: AUTH_FILES.admin, viewport: { width: 1280, height: 900 }, baseURL: WEB });

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function openBannerField(page: Page) {
  await page.context().request.delete(`${API}/admin/home-layout`, { headers: asBrowser });
  await page.goto("/admin/home");
  await page.getByRole("button", { name: "+ Add widget" }).click();
  await page.getByRole("button", { name: /^Wide image banner/ }).click();
  const field = page.getByText("Banner picture (required)", { exact: true }).locator("xpath=..");
  return { field, zone: field.locator("div[tabindex='-1']"), uploaded: field.locator('img[src*="/uploads/"]') };
}

test.describe("image fields accept drag and drop, pasted screenshots and the file picker", () => {
  test("dropping an image file uploads it", async ({ page }) => {
    const { zone, uploaded } = await openBannerField(page);
    await expect(uploaded).toHaveCount(0);
    await zone.evaluate((el, b64) => {
      const dt = new DataTransfer();
      dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], "dropped.png", { type: "image/png" }));
      el.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
      el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, PNG);
    await expect(uploaded).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Replace image" })).toBeVisible();
  });

  test("dropping something that is not an image shows a message", async ({ page }) => {
    const { zone, field } = await openBannerField(page);
    await zone.evaluate((el) => {
      const dt = new DataTransfer();
      dt.items.add(new File(["hello"], "notes.txt", { type: "text/plain" }));
      el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    await expect(field.getByRole("alert")).toHaveText("Drop an image file here");
  });

  test("Ctrl or ⌘ + V pastes a screenshot into the field under the pointer", async ({ page }) => {
    const { zone, uploaded } = await openBannerField(page);
    await zone.hover();
    await page.evaluate((b64) => {
      const dt = new DataTransfer();
      dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], "image.png", { type: "image/png" }));
      document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    }, PNG);
    await expect(uploaded).toHaveCount(1);
  });

  test("a paste while the pointer is elsewhere does not fill the field", async ({ page }) => {
    const { uploaded } = await openBannerField(page);
    await page.mouse.move(2, 2);
    await page.evaluate((b64) => {
      const dt = new DataTransfer();
      dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], "image.png", { type: "image/png" }));
      document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    }, PNG);
    await page.waitForTimeout(500);
    await expect(uploaded).toHaveCount(0);
  });

  test("the Paste screenshot button reads an image from the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: WEB });
    const { field, uploaded } = await openBannerField(page);
    const paste = field.getByRole("button", { name: "Paste screenshot" });
    await paste.click();
    await expect(field.getByRole("alert")).toContainText("no image on the clipboard");
    await page.evaluate(async (b64) => {
      const blob = new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: "image/png" });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    }, PNG);
    await paste.click();
    await expect(uploaded).toHaveCount(1);
  });

  test("the file picker still works and the field has no accessibility problems", async ({ page }) => {
    const { field, uploaded } = await openBannerField(page);
    await field.locator("input[type=file]").setInputFiles({ name: "picked.png", mimeType: "image/png", buffer: Buffer.from(PNG, "base64") });
    await expect(uploaded).toHaveCount(1);
    const result = await new AxeBuilder({ page }).include("div[tabindex='-1']").analyze();
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
  test("pictures are cropped to the spot's shape unless the option is turned off", async ({ page }) => {
    const { field, zone, uploaded } = await openBannerField(page);
    // A square picture dropped into a 3:1 banner spot.
    const drop = (name: string) => zone.evaluate(async (el, n) => {
      const c = document.createElement("canvas");
      c.width = 900; c.height = 900;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#c33"; ctx.fillRect(0, 0, 900, 900);
      ctx.fillStyle = "#39c"; ctx.fillRect(300, 300, 300, 300);
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
      const dt = new DataTransfer();
      dt.items.add(new File([blob], n, { type: "image/png" }));
      el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, name);
    const ratio = () => uploaded.evaluate(async (img: HTMLImageElement) => { await img.decode(); return img.naturalWidth / img.naturalHeight; });

    const crop = field.getByLabel(/^Crop automatically to fit/);
    await expect(crop).toBeChecked();
    await expect(field.getByText(/Cuts the picture to 2400 × 800 px/)).toBeVisible();
    await drop("square.png");
    await expect(uploaded).toHaveCount(1);
    expect(Math.abs((await ratio()) - 3)).toBeLessThan(0.05);

    await crop.uncheck();
    await drop("square-again.png");
    await expect.poll(ratio).toBeCloseTo(1, 1);
  });

  test("the upload endpoint crops on request and refuses a nonsense size", async ({ request }) => {
    const png = Buffer.from(PNG, "base64");
    const ok = await request.post(`${API}/admin/uploads?crop=64x32`, { multipart: { file: { name: "a.png", mimeType: "image/png", buffer: png } }, headers: asBrowser });
    expect(ok.ok(), await ok.text()).toBeTruthy();
    const body = (await ok.json()) as { url: string; cropped: boolean };
    expect(body.cropped).toBe(true);
    expect(body.url).toMatch(/^\/uploads\/[a-f0-9]{32}\.webp$/);
    const plain = await request.post(`${API}/admin/uploads`, { multipart: { file: { name: "a.png", mimeType: "image/png", buffer: png } }, headers: asBrowser });
    expect(((await plain.json()) as { cropped: boolean }).cropped).toBe(false);
    for (const bad of ["abc", "99999x10", "10x10"]) {
      const res = await request.post(`${API}/admin/uploads?crop=${bad}`, { multipart: { file: { name: "a.png", mimeType: "image/png", buffer: png } }, headers: asBrowser });
      expect(res.status(), bad).toBe(400);
    }
  });
});
