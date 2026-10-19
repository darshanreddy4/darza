import { pick } from "./helpers";
import { expect, test } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser } from "./helpers";

test.use({ storageState: AUTH_FILES.admin, viewport: { width: 1280, height: 900 } });

const tiles = (n: number) => Array.from({ length: n }, (_, i) => ({ imageUrl: `/uploads/e2e-tile-${i + 1}.png`, title: `Slide ${i + 1}`, text: "", linkUrl: "/products" }));

test.describe.serial("image tile slider", () => {
  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ storageState: AUTH_FILES.admin });
    await ctx.delete(`${API}/admin/home-layout`, { headers: asBrowser });
    await ctx.dispose();
  });

  const publish = (request: import("@playwright/test").APIRequestContext, items: unknown[], perView = 3) =>
    request.put(`${API}/admin/home-layout`, { data: { widgets: [{ type: "tile-carousel", config: { title: "Slider", perView, items } }] }, headers: asBrowser });

  test("shows a few tiles in one row and slides to the rest with the side arrows", async ({ page, request }) => {
    expect((await publish(request, tiles(6))).ok()).toBeTruthy();
    await page.goto("/");

    for (const n of [1, 2, 3]) await expect(page.getByRole("heading", { name: `Slide ${n}` })).toBeInViewport();
    await expect(page.getByRole("heading", { name: "Slide 4" })).not.toBeInViewport();
    await expect(page.getByRole("button", { name: "Previous Slider" })).toBeDisabled();

    await page.getByRole("button", { name: "Next Slider" }).click();
    await expect(page.getByRole("heading", { name: "Slide 4" })).toBeInViewport();
    await expect(page.getByRole("heading", { name: "Slide 1" })).not.toBeInViewport();

    await page.getByRole("button", { name: "Previous Slider" }).click();
    await expect(page.getByRole("heading", { name: "Slide 1" })).toBeInViewport();
  });

  test("a tile with a link goes to its page", async ({ page, request }) => {
    expect((await publish(request, tiles(4), 4)).ok()).toBeTruthy();
    await page.goto("/");
    await page.getByRole("link", { name: /Slide 2/ }).click();
    await expect(page).toHaveURL(/\/products$/);
  });

  test("no arrows when everything already fits", async ({ page, request }) => {
    expect((await publish(request, tiles(2), 3)).ok()).toBeTruthy();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Slide 2" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Next Slider" })).toHaveCount(0);
  });

  test("it holds up to 20 tiles and can be set up in the admin", async ({ page, request }) => {
    const res = await publish(request, tiles(25));
    expect(res.ok()).toBeTruthy();
    expect(((await res.json()).widgets[0].config.items as unknown[]).length).toBe(20);

    await request.delete(`${API}/admin/home-layout`, { headers: asBrowser });
    await page.goto("/admin/home");
    await page.getByRole("button", { name: "+ Add widget" }).click();
    await page.getByRole("button", { name: /^Image tile slider/ }).click();
    await expect(page.getByLabel(/^Tiles visible at once/)).toContainText("4");
    await pick(page.getByLabel(/^Tiles visible at once/), "3");
    await page.getByRole("button", { name: "+ Add a tile" }).click();
    await page.getByPlaceholder("or paste an https:// image address").fill("https://example.com/a.png");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved. Your home page is updated.")).toBeVisible();
    await expect(page.getByText("1 tile · 3 at a time")).toBeVisible();
  });
});
