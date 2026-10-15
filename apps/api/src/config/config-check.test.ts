import test from "node:test";
import assert from "node:assert/strict";
import { assertAdminPassword, assertProductionConfig } from "./config-check";

const good = {
  NODE_ENV: "production", JWT_SECRET: "x7Qv9LmP2aTn4RbW8ZkY1cHs6DfG0JeU3", WEB_ORIGIN: "https://dmg.example",
  MAIL_FROM: "no-reply@dmg.example", AWS_REGION: "ap-south-1", MEILI_URL: "http://meili:7700", MEILI_MASTER_KEY: "k9Zp3Vn7Qw2Lm8Xr4Ty6Ub1Hc5Dj0Fa",
} as NodeJS.ProcessEnv;

test("development is never blocked", () => {
  assert.doesNotThrow(() => assertProductionConfig({ NODE_ENV: "development", JWT_SECRET: "x" } as NodeJS.ProcessEnv));
});

test("a complete production config passes", () => {
  assert.doesNotThrow(() => assertProductionConfig(good));
});

test("example secrets and plain http origins are rejected", () => {
  assert.throws(() => assertProductionConfig({ ...good, JWT_SECRET: "change-me-to-a-long-random-string-0123456789" }), /JWT_SECRET/);
  assert.throws(() => assertProductionConfig({ ...good, WEB_ORIGIN: "http://dmg.example" }), /WEB_ORIGIN/);
  assert.throws(() => assertProductionConfig({ ...good, MEILI_MASTER_KEY: "dmg-dev-master-key-0123456789" }), /MEILI_MASTER_KEY/);
  assert.throws(() => assertProductionConfig({ ...good, MAIL_FROM: "" }), /MAIL_FROM/);
});

test("weak admin passwords are rejected only in production", () => {
  assert.throws(() => assertAdminPassword("change-me-now", { NODE_ENV: "production" } as NodeJS.ProcessEnv), /ADMIN_PASSWORD/);
  assert.throws(() => assertAdminPassword("short", { NODE_ENV: "production" } as NodeJS.ProcessEnv), /ADMIN_PASSWORD/);
  assert.doesNotThrow(() => assertAdminPassword("a-long-unique-passphrase", { NODE_ENV: "production" } as NodeJS.ProcessEnv));
  assert.doesNotThrow(() => assertAdminPassword("change-me-now", { NODE_ENV: "development" } as NodeJS.ProcessEnv));
});

test("rate limiting cannot be switched off in production", () => {
  assert.throws(() => assertProductionConfig({ ...good, DISABLE_RATE_LIMIT: "true" }), /DISABLE_RATE_LIMIT/);
  assert.doesNotThrow(() => assertProductionConfig({ NODE_ENV: "development", DISABLE_RATE_LIMIT: "true" } as NodeJS.ProcessEnv));
});

test("one-time codes can never be returned in responses in production", () => {
  assert.throws(() => assertProductionConfig({ ...good, OTP_DEBUG_RESPONSE: "true" }), /OTP_DEBUG_RESPONSE/);
});
