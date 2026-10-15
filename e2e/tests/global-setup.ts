import { request } from "@playwright/test";
import { mkdirSync } from "fs";
import { ADMIN, API, AUTH_FILES, CUSTOMER, WEB } from "./data";

// Logs in once per role through the API and saves the session cookie, so the tests
// do not hit the login rate limit and start already signed in.
export default async function globalSetup() {
  mkdirSync(".auth", { recursive: true });
  for (const [who, account] of [["admin", ADMIN], ["customer", CUSTOMER]] as const) {
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { origin: WEB } });
    const res = await ctx.post("/auth/login", { data: { email: account.email, password: account.password } });
    if (!res.ok()) throw new Error(`Could not log in ${account.email} (${res.status()}). Did you run the e2e seed? npm run db:seed:e2e in apps/api`);
    await ctx.storageState({ path: AUTH_FILES[who] });
    await ctx.dispose();
  }
}
