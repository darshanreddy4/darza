import { test } from "node:test";
import assert from "node:assert/strict";
import { normalisePhone, maskPhone } from "./phone";
import { passwordProblem } from "./password-rules";
import { checkOtp, hashOtp, newOtp, otpMatches, OTP_MAX_ATTEMPTS } from "./otp";
import { verifyGoogleIdToken } from "./google";

test("Indian mobile numbers are stored in one shape", () => {
  for (const input of ["9876543210", "+91 98765 43210", "91-9876543210", "09876543210", "(+91) 98765-43210"]) assert.equal(normalisePhone(input), "+919876543210", input);
});

test("other countries need a +, and nonsense is rejected", () => {
  assert.equal(normalisePhone("+1 (415) 555-0132"), "+14155550132");
  for (const bad of ["12345", "5876543210", "+0123456789", "hello", "", "98765 43210 99", "+12", "9876543210; drop table"]) assert.equal(normalisePhone(bad), null, bad);
});

test("masking hides the middle of a number", () => {
  assert.equal(maskPhone("+919876543210"), "+91 ••••••3210");
});

test("passwords need length, letters and numbers and must not be common", () => {
  assert.equal(passwordProblem("Tr1cky-Horse"), null);
  assert.match(passwordProblem("short1")!, /8 characters/);
  assert.match(passwordProblem("onlyletters")!, /letters and numbers/);
  assert.match(passwordProblem("12345678")!, /letters and numbers/);
  assert.match(passwordProblem("Password123")!, /too common/);
  assert.match(passwordProblem("aaaaaaaa1".slice(0, 8) + "")!, /letters and numbers|common/);
  assert.match(passwordProblem("asha.kumar2026", { email: "asha.kumar@example.com" })!, /email/);
  assert.match(passwordProblem("x".repeat(129) + "1")!, /at most/);
});

test("one-time codes are six digits and only their hash matches", () => {
  const code = newOtp();
  assert.match(code, /^\d{6}$/);
  const hash = hashOtp("+919876543210", code, "secret");
  assert.ok(otpMatches("+919876543210", code, "secret", hash));
  assert.ok(!otpMatches("+919876543210", "000000" === code ? "111111" : "000000", "secret", hash));
  assert.ok(!otpMatches("+919999999999", code, "secret", hash), "bound to the phone number");
  assert.ok(!otpMatches("+919876543210", code, "other-secret", hash), "bound to the server secret");
});

test("a code can be used once, in time, and only a few guesses are allowed", () => {
  const now = new Date("2026-01-01T10:00:00Z");
  const live = { expiresAt: new Date("2026-01-01T10:05:00Z"), attempts: 0, consumedAt: null };
  assert.equal(checkOtp(live, true, now), "ok");
  assert.equal(checkOtp(live, false, now), "wrong");
  assert.equal(checkOtp({ ...live, expiresAt: new Date("2026-01-01T09:59:00Z") }, true, now), "expired");
  assert.equal(checkOtp({ ...live, consumedAt: now }, true, now), "expired");
  assert.equal(checkOtp({ ...live, attempts: OTP_MAX_ATTEMPTS }, true, now), "locked");
});

const token = (over: Record<string, string>) => ({ ok: true, json: async () => ({ iss: "https://accounts.google.com", aud: "client-1", sub: "g-1", email: "Asha@Example.com", email_verified: "true", name: "Asha K", exp: String(Math.floor(Date.now() / 1000) + 600), ...over }) });

test("a valid Google token gives the profile", async () => {
  const p = await verifyGoogleIdToken("tok", "client-1", async () => token({}));
  assert.deepEqual([p?.sub, p?.email, p?.name], ["g-1", "asha@example.com", "Asha K"]);
});

test("Google tokens for another site, expired, unverified or forged are refused", async () => {
  for (const over of [{ aud: "someone-else" }, { iss: "https://evil.example" }, { exp: "1" }, { email_verified: "false" }, { sub: "" }]) {
    assert.equal(await verifyGoogleIdToken("tok", "client-1", async () => token(over)), null, JSON.stringify(over));
  }
  assert.equal(await verifyGoogleIdToken("tok", "client-1", async () => ({ ok: false, json: async () => ({}) })), null);
  assert.equal(await verifyGoogleIdToken("tok", "client-1", async () => { throw new Error("network"); }), null);
  assert.equal(await verifyGoogleIdToken("", "client-1", async () => token({})), null);
  assert.equal(await verifyGoogleIdToken("tok", "", async () => token({})), null);
});
