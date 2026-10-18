import { expect, test } from "@playwright/test";
import { API, PASSWORD, WEB } from "./data";
import { asBrowser } from "./helpers";

test.describe("running the service", () => {
  test("the health checks answer for load balancers", async ({ request }) => {
    expect((await request.get(`${API}/health`)).status()).toBe(200);
    const ready = await request.get(`${API}/health/ready`);
    expect(ready.status()).toBe(200);
    expect(await ready.json()).toEqual({ status: "ok", checks: { database: "ok", storage: "ok" } });
    const web = await request.get(`${WEB}/health`);
    expect(web.status()).toBe(200);
  });

  test("five wrong passwords lock the account for a while, even for the right password", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: WEB, storageState: { cookies: [], origins: [] } });
    const email = `lockout-${Date.now()}@dmg.test`;
    const register = await context.request.post(`${API}/auth/register`, { data: { email, name: "Lock Tester", password: PASSWORD, termsAccepted: true }, headers: asBrowser });
    expect(register.ok()).toBeTruthy();
    const attempt = (password: string) => context.request.post(`${API}/auth/login`, { data: { email, password }, headers: asBrowser });

    for (let i = 0; i < 4; i++) expect((await attempt(`wrong-${i}-password`)).status()).toBe(401);
    // A correct sign-in before the limit starts the count again.
    expect((await attempt(PASSWORD)).ok()).toBeTruthy();
    for (let i = 0; i < 5; i++) expect((await attempt(`wrong-${i}-password`)).status()).toBe(401);

    const locked = await attempt(PASSWORD);
    expect(locked.status()).toBe(429);
    expect(JSON.stringify(await locked.json())).toContain("Too many wrong passwords");
    await context.close();
  });
  test("a number can be sent only five codes an hour, however often resend is pressed", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: WEB, storageState: { cookies: [], origins: [] } });
    const phone = `95${String(Date.now()).slice(-8)}`;
    const send = () => context.request.post(`${API}/auth/otp/send`, { data: { phone, purpose: "signup" }, headers: asBrowser });
    const gap = () => new Promise((r) => setTimeout(r, 3300));

    expect((await send()).status()).toBe(201);
    // Pressing again straight away is refused by the resend gap.
    expect((await send()).status()).toBe(429);
    for (let i = 0; i < 4; i++) { await gap(); expect((await send()).status(), `code ${i + 2}`).toBe(201); }
    await gap();
    const sixth = await send();
    expect(sixth.status()).toBe(429);
    expect(JSON.stringify(await sixth.json())).toContain("Too many codes");
    await context.close();
  });
});
