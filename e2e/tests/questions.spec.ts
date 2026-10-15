import { expect, test, type BrowserContext } from "@playwright/test";
import { API, AUTH_FILES } from "./data";
import { asBrowser, newCustomer } from "./helpers";

test.use({ storageState: AUTH_FILES.admin });

const QUESTION = "Can this power bank charge two phones at the same time?";
const ANSWER = "Yes, both USB ports can charge at once.";

test.describe.serial("product questions", () => {
  let customer: BrowserContext;

  test.beforeAll(async ({ browser }) => { customer = await newCustomer(browser, "Quentin Asker"); });
  test.afterAll(async () => { await customer.close(); });

  test("a shopper asks a question, and it stays private until answered", async () => {
    const page = await customer.newPage();
    await page.goto("/products/e2e-power-bank");
    await page.getByLabel("Your question").fill("short");
    await page.getByRole("button", { name: "Send question" }).click();
    await expect(page.locator("#question:invalid")).toHaveCount(1);

    await page.getByLabel("Your question").fill(QUESTION);
    await page.getByRole("button", { name: "Send question" }).click();
    await expect(page.getByText(/will appear here once we have answered it/)).toBeVisible();

    await page.reload();
    await expect(page.getByText(QUESTION)).toHaveCount(0);
    await expect(page.getByText("No questions answered yet")).toBeVisible();
    await page.close();
  });

  test("the admin answers it from the Questions page", async ({ page }) => {
    await page.goto("/admin/questions");
    const row = page.getByRole("article", { name: "Question about E2E Power Bank 10000mAh" }).filter({ hasText: QUESTION });
    await expect(row).toContainText("Quentin Asker");
    await row.getByLabel("Your answer").fill(ANSWER);
    await row.getByRole("button", { name: "Publish answer" }).click();
    await expect(page.getByText("Answer published on the product page")).toBeVisible();
  });

  test("the answered question is public on the product page", async ({ browser }) => {
    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await visitor.newPage();
    await page.goto("/products/e2e-power-bank");
    const section = page.locator("#questions");
    await expect(section.getByText(QUESTION)).toBeVisible();
    await expect(section.getByText(ANSWER)).toBeVisible();
    await expect(section.getByText(/Asked by Quentin/)).toBeVisible();
    await expect(section.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Questions" }).first()).toHaveAttribute("href", "#questions");
    await visitor.close();
  });

  test("only a few unanswered questions are allowed at a time", async () => {
    const ask = () => customer.request.post(`${API}/products/e2e-power-bank/questions`, { data: { question: `Is the warranty valid in every state? ${Math.random()}` }, headers: asBrowser });
    for (let i = 0; i < 3; i++) expect((await ask()).status()).toBe(201);
    const blocked = await ask();
    expect(blocked.status()).toBe(400);
    expect(JSON.stringify(await blocked.json())).toContain("waiting for an answer");
  });

  test("questions are managed by admins only", async () => {
    expect((await customer.request.get(`${API}/admin/questions`, { headers: asBrowser })).status()).toBe(403);
    expect((await customer.request.get(`${API}/products/missing-product/questions`)).status()).toBe(404);
  });
});
