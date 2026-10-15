import { expect, test } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

type Settings = Record<string, unknown> & { freeShippingOverPaise: number | null };

async function save(request: import("@playwright/test").APIRequestContext, over: Record<string, unknown>) {
  const s = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Settings;
  return request.put(`${API}/admin/settings`, {
    data: { shippingFeePaise: s.shippingFeePaise, freeShippingOverPaise: s.freeShippingOverPaise ?? 0, gstEnabled: s.gstEnabled, gstin: s.gstin ?? "", legalName: s.legalName ?? "", businessAddress: s.businessAddress ?? "", businessState: s.businessState ?? "", shippingGstPercent: s.shippingGstPercent, invoicePrefix: s.invoicePrefix, ...over },
    headers: asBrowser,
  });
}

test.describe.serial("scheduled sales report", () => {
  test.afterAll(async ({ request }) => { await save(request, { reportSchedule: "OFF", reportEmail: "" }); });

  test("a schedule needs an address, and sending needs a saved schedule", async ({ request }) => {
    await save(request, { reportSchedule: "OFF", reportEmail: "" });
    const noAddress = await save(request, { reportSchedule: "WEEKLY", reportEmail: "" });
    expect(noAddress.status()).toBe(400);
    expect(JSON.stringify(await noAddress.json())).toContain("email address");
    const bad = await save(request, { reportSchedule: "WEEKLY", reportEmail: "nope" });
    expect(bad.status()).toBe(400);
    const early = await request.post(`${API}/admin/sales-report/send`, { headers: asBrowser });
    expect(early.status()).toBe(400);
  });

  test("the schedule is set in Settings and the report can be sent to try it", async ({ page, request }) => {
    await page.goto("/admin/settings");
    await expect(page.getByRole("button", { name: "Send the last report now" })).toBeDisabled();
    await page.getByLabel("How often").selectOption("WEEKLY");
    await page.getByLabel("Send it to").fill("accounts@dmg.test");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();

    const saved = (await (await request.get(`${API}/admin/settings`, { headers: asBrowser })).json()) as Settings;
    expect(saved).toMatchObject({ reportSchedule: "WEEKLY", reportEmail: "accounts@dmg.test" });
    // Switching on starts the count from now, so nothing is due until the next Monday.
    expect(saved.reportLastSentAt).toBeTruthy();

    await page.reload();
    await page.getByRole("button", { name: "Send the last report now" }).click();
    await expect(page.getByText(/Sent the report for Week of .* to accounts@dmg\.test/)).toBeVisible();
  });

  test("the send endpoint reports the period and is admin only", async ({ request, browser }) => {
    const res = await request.post(`${API}/admin/sales-report/send`, { headers: asBrowser });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ sent: true, to: "accounts@dmg.test" });
    const customer = await browser.newContext({ storageState: AUTH_FILES.customer });
    expect((await customer.request.post(`${API}/admin/sales-report/send`, { headers: asBrowser })).status()).toBe(403);
    await customer.close();
  });

  test("monthly works the same way", async ({ request }) => {
    expect((await save(request, { reportSchedule: "MONTHLY", reportEmail: "accounts@dmg.test" })).ok()).toBeTruthy();
    const res = await request.post(`${API}/admin/sales-report/send`, { headers: asBrowser });
    expect((await res.json()).label).toMatch(/^[A-Z][a-z]+ \d{4}$/);
  });
});
