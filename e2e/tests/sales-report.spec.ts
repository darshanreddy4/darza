import { expect, test } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { adminProduct, asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const today = () => new Date(Date.now() + 19_800_000).toISOString().slice(0, 10);

test.describe.serial("sales report", () => {
  let orderRef = "";

  test.beforeAll(async ({ browser, request }) => {
    const shopper = await newCustomer(browser, "Report Buyer");
    const product = await adminProduct(request, "e2e-power-bank");
    const res = await shopper.request.post(`${API}/orders`, {
      data: { items: [{ productId: product.id, quantity: 2 }], shipping: { name: "Report Buyer", phone: "9876500002", line1: "2 Report Road", city: "Pune", state: "Maharashtra", pincode: "411001" }, paymentMethod: "COD" },
      headers: asBrowser,
    });
    expect(res.status()).toBe(201);
    orderRef = `#${((await res.json()) as { order: { id: string } }).order.id.slice(-8).toUpperCase()}`;
    await shopper.close();
  });

  test("the report lists the order with its money figures and a totals row", async ({ request }) => {
    const res = await request.get(`${API}/admin/analytics/report?from=2020-01-01&to=${today()}`, { headers: asBrowser });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-disposition"]).toContain(`sales-report-2020-01-01_${today()}.csv`);
    const text = await res.text();
    expect(text.startsWith("\uFEFFOrder,Date (IST),Invoice no.,Customer,Contact,Status,Counts as sale,Payment,Units,Items (INR)")).toBe(true);

    const line = text.split("\r\n").find((l) => l.startsWith(orderRef));
    expect(line, `row for ${orderRef}`).toBeTruthy();
    const cells = line!.split(",");
    expect(cells[3]).toBe("Report Buyer");
    expect(cells[5]).toBe("PLACED");
    expect(cells[6]).toBe("Yes");
    expect(cells[7]).toBe("COD");
    expect(cells[8]).toBe("2");
    expect(cells[9]).toBe("2998.00");
    expect(text).toContain("Total (orders that count as sales)");
  });

  test("a range that holds no orders gives just the header and totals", async ({ request }) => {
    const res = await request.get(`${API}/admin/analytics/report?from=2001-01-01&to=2001-01-31`, { headers: asBrowser });
    const lines = (await res.text()).trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Total (orders that count as sales)");
  });

  test("bad dates are refused and only admins can download", async ({ request, browser }) => {
    expect((await request.get(`${API}/admin/analytics/report?from=tomorrow`, { headers: asBrowser })).status()).toBe(400);
    expect((await request.get(`${API}/admin/analytics/report?from=2026-02-01&to=2026-01-01`, { headers: asBrowser })).status()).toBe(400);
    const customer = await browser.newContext({ storageState: AUTH_FILES.customer });
    expect((await customer.request.get(`${API}/admin/analytics/report`, { headers: asBrowser })).status()).toBe(403);
    await customer.close();
  });

  test("the analytics page downloads the report for the chosen dates", async ({ page }) => {
    await page.goto("/admin/analytics");
    await page.getByLabel("From date").fill("2026-01-01");
    await page.getByLabel("To date").fill(today());
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download sales report" }).click()]);
    expect(download.suggestedFilename()).toBe(`sales-report-2026-01-01_${today()}.csv`);
    expect((await import("fs")).readFileSync(await download.path(), "utf8")).toContain(orderRef);
  });
});
