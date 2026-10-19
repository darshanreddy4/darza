import { defineConfig, devices } from "@playwright/test";

// The suite runs against its own API (4100) and web app (3100) and a throwaway database,
// so it never touches the data you use for development.
//
//   E2E_DATABASE_URL   Postgres database that is migrated and seeded (required to start the servers)
//   E2E_REDIS_URL      optional; the cache is skipped when empty
//
// In CI and locally the servers are started for you; if they are already running they are reused.
const WEB = process.env.E2E_WEB_URL ?? "http://localhost:3100";
const API = process.env.E2E_API_URL ?? "http://localhost:4100";
const root = `${__dirname}/..`;

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  // The tests share one database (stock, orders, roles), so they run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: { baseURL: WEB, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run start",
      cwd: `${root}/apps/api`,
      url: `${API}/categories`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PORT: "4100",
        DISABLE_RATE_LIMIT: "true",
        // Exchange rates come from a small stand-in server the currency test starts, never from the internet.
        DISABLE_RATE_REFRESH: "true",
        EXCHANGE_RATE_URL: "http://127.0.0.1:4199/rates",
        // Lets the tests read the one-time code that would be sent by SMS.
        OTP_DEBUG_RESPONSE: "true",
        OTP_RESEND_SECONDS: "3",
        // Cart reminders are due straight away and checked every couple of seconds.
        CART_REMINDER_AFTER_MINUTES: "0",
        CART_REMINDER_INTERVAL_SECONDS: "2",
        STOCK_ALERT_INTERVAL_SECONDS: "2",
        INVENTORY_ALERT_INTERVAL_SECONDS: "2",
        // PIN codes are checked by their first digits only, never against a lookup service on the internet.
        PINCODE_LOOKUP: "off",
        GOOGLE_CLIENT_ID: "",
        DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
        JWT_SECRET: "e2e-only-secret-that-is-long-enough-0123456789",
        WEB_ORIGIN: WEB,
        COOKIE_DOMAIN: "",
        REDIS_URL: process.env.E2E_REDIS_URL ?? "",
        MEILI_URL: "",
        RAZORPAY_KEY_ID: "",
        RAZORPAY_KEY_SECRET: "",
        RAZORPAY_WEBHOOK_SECRET: "",
      },
    },
    {
      command: "npx next start -p 3100",
      cwd: `${root}/apps/web`,
      url: WEB,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
