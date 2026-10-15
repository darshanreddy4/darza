import { expect, test, type Page } from "@playwright/test";
import { money } from "./data";

test.use({ storageState: { cookies: [], origins: [] } });

const card = (page: Page, name: string) => page.locator("div.group").filter({ hasText: name }).first();

test.describe("product comparison", () => {
  test("pick products, see them side by side, and keep the choice", async ({ page }) => {
    await page.goto("/products");
    await card(page, "E2E USB-C Cable").getByRole("button", { name: "Compare this product" }).click();
    const bar = page.getByRole("region", { name: "Product comparison" });
    await expect(bar).toContainText("1 of 4 selected");
    await expect(bar.getByRole("link", { name: /add one more/ })).toBeVisible();
    await card(page, "E2E Power Bank").getByRole("button", { name: "Compare this product" }).click();
    await expect(bar).toContainText("2 of 4 selected");

    await bar.getByRole("link", { name: "Compare" }).click();
    await expect(page).toHaveURL(/\/compare/);
    const table = page.getByRole("table", { name: /Comparison of/ });
    await expect(table.getByRole("link", { name: "E2E USB-C Cable" })).toBeVisible();
    await expect(table.getByRole("link", { name: /E2E Power Bank/ })).toBeVisible();
    await expect(table.getByRole("row", { name: /^Price/ })).toContainText(money(29900));
    await expect(table.getByRole("row", { name: /^Price/ })).toContainText(money(149900));
    await expect(table.getByRole("row", { name: /^Price/ })).toContainText("Lowest");

    await page.reload();
    await expect(page.getByRole("table", { name: /Comparison of/ }).getByRole("link", { name: "E2E USB-C Cable" })).toBeVisible();
  });

  test("differences can be isolated and a product removed", async ({ page }) => {
    await page.goto("/products");
    for (const name of ["E2E USB-C Cable", "E2E Power Bank"]) await card(page, name).getByRole("button", { name: "Compare this product" }).click();
    await page.goto("/compare");

    const rowLabels = () => page.getByRole("table").getByRole("rowheader").allTextContents();
    await expect.poll(rowLabels).toContain("Availability");
    await page.getByLabel("Show only differences").check();
    await expect.poll(rowLabels).toContain("Price");
    await expect.poll(rowLabels).not.toContain("Availability");

    await page.getByRole("button", { name: /Remove E2E USB-C Cable from comparison/ }).click();
    await expect(page.getByRole("status")).toContainText("Add at least one more product");
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page.getByText(/Pick two to 4 products/)).toBeVisible();
  });

  test("a partner product and our own can be compared, and the list holds four", async ({ page }) => {
    await page.goto("/products");
    await card(page, "E2E Partner Speaker").getByRole("button", { name: "Compare this product" }).click();
    await card(page, "E2E USB-C Cable").getByRole("button", { name: "Compare this product" }).click();
    await page.goto("/compare");
    await expect(page.getByRole("row", { name: /^Availability/ })).toContainText("Available on Amazon");
    await expect(page.getByRole("row", { name: /^Availability/ })).toContainText("In stock");

    // Three more picks fill the list; a fifth is refused.
    await page.goto("/products");
    await page.evaluate(() => localStorage.setItem("dmg-compare", JSON.stringify(["a1b2c3d4e5f6", "b1b2c3d4e5f6", "c1b2c3d4e5f6", "d1b2c3d4e5f6"])));
    await page.reload();
    await expect(page.getByRole("region", { name: "Product comparison" })).toContainText("4 of 4 selected");
    await card(page, "E2E Power Bank").getByRole("button", { name: "Compare this product" }).click();
    await expect(page.locator("main").getByRole("alert").filter({ hasText: "up to 4 products" })).toHaveCount(1);
    await expect(card(page, "E2E Power Bank").getByRole("button", { name: "Compare this product" })).toHaveAttribute("aria-pressed", "false");
  });

  test("the product page has its own compare button", async ({ page }) => {
    await page.goto("/products/e2e-power-bank");
    await page.getByRole("button", { name: /^Compare$/ }).click();
    await expect(page.getByRole("button", { name: "Added to comparison" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("region", { name: "Product comparison" })).toContainText("1 of 4 selected");
  });
});
