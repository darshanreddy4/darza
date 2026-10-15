import { expect, test } from "@playwright/test";
import { AUTH_FILES } from "./data";

// A small phone. Nothing may force sideways scrolling, and controls must be big enough to tap.
test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

const PUBLIC_PAGES = ["/", "/products", "/products/e2e-power-bank", "/products/e2e-sold-out-lamp", "/cart", "/login", "/signup", "/forgot-password", "/about", "/contact", "/terms", "/refund-policy"];
const CUSTOMER_PAGES = ["/account", "/orders", "/wishlist", "/checkout"];
const ADMIN_PAGES = ["/admin", "/admin/orders", "/admin/products", "/admin/returns", "/admin/questions", "/admin/analytics", "/admin/users", "/admin/settings", "/admin/coupons", "/admin/home"];

// WCAG 2.2 asks for at least 24 by 24 CSS pixels for buttons and fields. Checkboxes sit well apart from other controls, so they only need 16.
const MIN_TARGET = 24;

async function problems(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  return page.evaluate((min) => {
    const out: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > window.innerWidth + 1) {
      const wide = [...document.body.querySelectorAll<HTMLElement>("*")].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && !el.closest("[class*='overflow-x-auto'],[class*='overflow-auto'],[class*='no-scrollbar'],[class*='overflow-hidden']"));
      out.push(`page scrolls sideways (${doc.scrollWidth}px wide): ${wide.slice(0, 3).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 50)}`).join(" | ")}`);
    }
    const small = [...document.querySelectorAll<HTMLElement>("button, input:not([type=hidden]), select, textarea, [role=button]")].filter((el) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || style.visibility === "hidden" || el.closest("[hidden],.sr-only")) return false;
      if (el.classList.contains("sr-only")) return false;
      // Checkboxes only need room around them (the WCAG 2.2 spacing exception), so 16px is the floor.
      if ((el as HTMLInputElement).type === "checkbox" || (el as HTMLInputElement).type === "radio") {
        const label = (el as HTMLInputElement).labels?.[0];
        return Math.max(label?.getBoundingClientRect().height ?? 0, r.height) < 16;
      }
      return r.width < min || r.height < min;
    });
    for (const el of small.slice(0, 5)) out.push(`small control ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}: ${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"`);
    return out;
  }, MIN_TARGET);
}

test.describe("shoppers", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const path of PUBLIC_PAGES) test(path, async ({ page }) => { expect(await problems(page, path)).toEqual([]); });
});

test.describe("signed-in customer", () => {
  test.use({ storageState: AUTH_FILES.customer });
  for (const path of CUSTOMER_PAGES) test(path, async ({ page }) => { expect(await problems(page, path)).toEqual([]); });
});

test.describe("admin", () => {
  test.use({ storageState: AUTH_FILES.admin });
  for (const path of ADMIN_PAGES) test(path, async ({ page }) => { expect(await problems(page, path)).toEqual([]); });
});
