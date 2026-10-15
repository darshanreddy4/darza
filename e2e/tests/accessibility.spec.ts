import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILES } from "./data";

// Pages a shopper or an admin uses. Scanned at a desktop and a phone width against WCAG 2.1 A and AA.
const PUBLIC_PAGES = ["/", "/products", "/products/e2e-power-bank", "/products/e2e-sold-out-lamp", "/products?q=power", "/cart", "/login", "/signup", "/forgot-password", "/about", "/contact", "/terms", "/privacy", "/refund-policy", "/shipping-policy"];
const CUSTOMER_PAGES = ["/account", "/orders", "/wishlist", "/checkout"];
const ADMIN_PAGES = ["/admin", "/admin/orders", "/admin/products", "/admin/products/new", "/admin/returns", "/admin/questions", "/admin/abandoned-carts", "/admin/analytics", "/admin/users", "/admin/settings", "/admin/coupons", "/admin/home", "/admin/attention"];

const SIZES = [{ name: "desktop", width: 1366, height: 860 }, { name: "phone", width: 390, height: 844 }];

async function scan(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.help} -> ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
}

for (const size of SIZES) {
  test.describe(`accessibility at ${size.name} width`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test.describe("shoppers", () => {
      test.use({ storageState: { cookies: [], origins: [] } });
      for (const path of PUBLIC_PAGES) test(path, async ({ page }) => { expect(await scan(page, path)).toEqual([]); });
    });

    test.describe("signed-in customer", () => {
      test.use({ storageState: AUTH_FILES.customer });
      for (const path of CUSTOMER_PAGES) test(path, async ({ page }) => { expect(await scan(page, path)).toEqual([]); });
    });

    test.describe("admin", () => {
      test.use({ storageState: AUTH_FILES.admin });
      for (const path of ADMIN_PAGES) test(path, async ({ page }) => { expect(await scan(page, path)).toEqual([]); });
    });
  });
}
