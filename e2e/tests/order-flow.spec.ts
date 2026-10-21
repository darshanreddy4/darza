import { pick } from "./helpers";
import { expect, test } from "@playwright/test";
import { AUTH_FILES, money } from "./data";
import { adminProduct } from "./helpers";

// One shopper, one order: the customer buys, the admin ships it, the customer sees the result.
test.describe.serial("buying a DMG product", () => {
  let orderId = "";

  test.describe("as the customer", () => {
    test.use({ storageState: AUTH_FILES.customer });

    test("add to cart, apply a coupon, and pay on delivery", async ({ page }) => {
      await page.goto("/products/e2e-usb-cable");
      await page.getByRole("button", { name: "Add to Cart" }).click();
      await page.getByRole("link", { name: "Go to cart" }).click();

      await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();
      await expect(page.getByText("E2E USB-C Cable").first()).toBeVisible();

      await page.getByRole("link", { name: /checkout/i }).first().click();
      await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

      // ₹299 is under the free-delivery limit, so a delivery fee applies.
      const summary = page.locator("aside");
      // Wait for the server's price quote before touching the coupon box.
      await expect(summary).not.toContainText("Calculating");
      await expect(summary).toContainText("Delivery");
      await expect(summary).toContainText(money(4900));

      await page.getByLabel("Coupon code").fill("e2e50");
      await page.getByRole("button", { name: "Apply" }).click();
      await expect(summary).toContainText("E2E50");
      // 299 - 50 + 49
      await expect(summary).toContainText(money(29800));

      await page.getByPlaceholder("10-digit mobile number").fill("9876543210");
      await page.getByPlaceholder("Address line 1").fill("12 Test Street");
      await page.getByPlaceholder("City").fill("Bengaluru");
      await pick(page.getByLabel("State"), { label: "Karnataka" });
      await page.getByPlaceholder("Pincode").fill("560001");
      await page.getByRole("button", { name: /place order/i }).click();

      await expect(page).toHaveURL(/\/orders\?placed=1/);
      await expect(page.getByText("Your order has been placed")).toBeVisible();
    });

    test("the order shows up with an invoice", async ({ page, context }) => {
      await page.goto("/orders");
      await expect(page.getByText("Order placed").first()).toBeVisible();
      const invoice = page.getByRole("link", { name: /invoice/i }).first();
      const href = (await invoice.getAttribute("href")) ?? "";
      orderId = href.split("/").pop() ?? "";
      expect(orderId).not.toBe("");

      const popup = await context.newPage();
      await popup.goto(href);
      // GST is switched off by default, so the document is a bill of supply.
      await expect(popup.getByRole("heading", { name: "Bill of supply" })).toBeVisible();
      await expect(popup.getByText("E2E USB-C Cable")).toBeVisible();
      await expect(popup.getByText(money(29800)).first()).toBeVisible();
    });

    test("the saved address is offered on the next checkout", async ({ page }) => {
      await page.goto("/products/e2e-power-bank");
      await page.getByRole("button", { name: "Add to Cart" }).click();
      await page.goto("/checkout");
      await expect(page.getByRole("radiogroup", { name: "Saved addresses" })).toContainText("12 Test Street");
      // Free delivery above ₹499.
      await expect(page.locator("aside")).toContainText(/free/i);
    });
  });

  test.describe("as the admin", () => {
    test.use({ storageState: AUTH_FILES.admin });

    test("sees the order and marks it shipped", async ({ page }) => {
      await page.goto("/admin/orders");
      const select = page.getByLabel(`Status for order ${orderId.slice(-8)}`);
      await expect(select).toBeVisible();
      await pick(select, "SHIPPED");
      await page.getByLabel("Courier").fill("Delhivery");
      await page.getByLabel("Tracking number").fill("DL123456789");
      await page.getByLabel("Tracking link").fill("https://track.example/DL123456789");
      await page.getByRole("button", { name: "Mark as shipped" }).click();
      await expect(page.getByText("Order marked as shipped")).toBeVisible();
    });

    test("the stock went down by one", async ({ request }) => {
      const product = await adminProduct(request, "e2e-usb-cable");
      expect(product.stock).toBe(4);
    });
  });

  test.describe("back as the customer", () => {
    test.use({ storageState: AUTH_FILES.customer });

    test("sees the new status", async ({ page }) => {
      await page.goto("/orders");
      await expect(page.getByText("Shipped").first()).toBeVisible();
      const tracking = page.getByTestId("tracking").filter({ hasText: "DL123456789" });
      await expect(tracking).toContainText("Delhivery");
      await expect(tracking.getByRole("link", { name: "Track shipment" })).toHaveAttribute("href", "https://track.example/DL123456789");
    });
  });
});
