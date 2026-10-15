import { expect, test } from "@playwright/test";
import { AUTH_FILES } from "./data";

test.use({ storageState: AUTH_FILES.customer });

test.describe("profile menu", () => {
  test("closes when you click elsewhere, press Escape or pick a link", async ({ page }) => {
    await page.goto("/");
    const menu = page.locator("header details");
    const toggle = menu.locator("summary");
    const orders = menu.getByRole("link", { name: "My orders" });

    await toggle.click();
    await expect(orders).toBeVisible();
    await page.locator("main").click({ position: { x: 5, y: 200 } });
    await expect(orders).toBeHidden();

    await toggle.click();
    await expect(orders).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(orders).toBeHidden();

    await toggle.click();
    await orders.click();
    await expect(page).toHaveURL(/\/orders/);
    await expect(menu.getByRole("link", { name: "My orders" })).toBeHidden();

    await toggle.click();
    await toggle.click();
    await expect(orders).toBeHidden();
  });
});
