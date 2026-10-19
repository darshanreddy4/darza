import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { AUTH_FILES } from "./data";

test.describe("dropdowns on the storefront", () => {
  test.use({ storageState: AUTH_FILES.customer, viewport: { width: 1280, height: 800 } });

  async function openAddressForm(page: import("@playwright/test").Page) {
    await page.goto("/account");
    await page.getByRole("button", { name: "+ Add address" }).click();
    return page.getByRole("button", { name: "State" });
  }

  test("the list opens right under the field, closes with Escape and picks by typing", async ({ page }) => {
    const state = await openAddressForm(page);
    await state.click();
    const list = page.getByRole("listbox", { name: "State choices" });
    await expect(list).toBeVisible();
    const b = (await state.boundingBox())!;
    const l = (await list.boundingBox())!;
    expect(l.y).toBeGreaterThanOrEqual(b.y + b.height);
    expect(l.y - (b.y + b.height)).toBeLessThan(16);
    expect(l.x).toBeLessThanOrEqual(b.x + 2);
    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);
    await expect(state).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await page.keyboard.type("Kar");
    await page.keyboard.press("Enter");
    await expect(state).toContainText("Karnataka");
    await expect(page.locator('input[name="state"]')).toHaveValue("Karnataka");
  });

  test("a required dropdown is invalid until something is chosen", async ({ page }) => {
    const state = await openAddressForm(page);
    await expect(state).toContainText("Select state");
    expect(await page.locator('input[name="state"]').evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
    await state.click();
    await page.getByRole("option", { name: "Goa", exact: true }).click();
    expect(await page.locator('input[name="state"]').evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(false);
  });

  for (const height of [300, 420]) {
    test(`in a ${height}px high window the list never overlaps the field or leaves the screen`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height });
      const state = await openAddressForm(page);
      await state.click();
      const list = page.getByRole("listbox", { name: "State choices" });
      await expect(list).toBeVisible();
      const b = (await state.boundingBox())!;
      const l = (await list.boundingBox())!;
      expect(l.y).toBeGreaterThanOrEqual(0);
      expect(l.y + l.height).toBeLessThanOrEqual(height);
      const below = l.y >= b.y + b.height;
      const above = l.y + l.height <= b.y + 1;
      expect(below || above).toBe(true);
    });
  }
});

test.describe("dropdowns in the admin", () => {
  test.use({ storageState: AUTH_FILES.admin, viewport: { width: 1280, height: 800 } });

  test("a dropdown inside a scrolling table is not cut off", async ({ page }) => {
    await page.goto("/admin/users");
    const role = page.getByLabel(/^Role for /).first();
    await expect(role).toBeVisible();
    await role.click();
    const list = page.getByRole("listbox").first();
    await expect(list).toBeVisible();
    const box = (await list.boundingBox())!;
    const topmost = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[role="listbox"]') !== null, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    expect(topmost).toBe(true);
    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);
  });

  test("clicking an option inside a labelled field picks it and does not reopen the list", async ({ page }) => {
    await page.goto("/admin/appearance");
    const field = page.getByRole("button", { name: /Currency shown to new visitors/ });
    await page.getByText("Currency shown to new visitors").click();
    const list = page.getByRole("listbox");
    await expect(list).toBeVisible();
    await list.getByRole("option", { name: /^INR/ }).click();
    await expect(list).toHaveCount(0);
    await expect(field).toContainText("INR");
  });

  test("an open list has no accessibility problems", async ({ page }) => {
    await page.goto("/admin/users");
    await page.getByLabel("Filter by role").click();
    await expect(page.getByRole("listbox")).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const problems = results.violations.map((v) => `${v.id} x${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.html.slice(0, 120)).join(" | ")}`);
    expect(problems).toEqual([]);
  });
});
