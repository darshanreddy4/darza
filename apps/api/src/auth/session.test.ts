import test from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import { isTrustedOrigin, readSessionCookie } from "./session-cookie";
import { hashToken, newToken } from "./tokens";

const req = (method: string, headers: Record<string, string> = {}) => ({ method, headers }) as unknown as Request;

test("reads the session cookie among others", () => {
  assert.equal(readSessionCookie(req("GET", { cookie: "a=1; dmg_session=abc.def; b=2" })), "abc.def");
  assert.equal(readSessionCookie(req("GET", { cookie: "other=1" })), undefined);
  assert.equal(readSessionCookie(req("GET")), undefined);
});

test("state-changing requests must come from the web origin", () => {
  process.env.WEB_ORIGIN = "https://shop.example";
  assert.ok(isTrustedOrigin(req("POST", { origin: "https://shop.example" })));
  assert.ok(isTrustedOrigin(req("GET", { origin: "https://evil.example" })));
  assert.ok(isTrustedOrigin(req("POST")));
  assert.equal(isTrustedOrigin(req("POST", { origin: "https://evil.example" })), false);
  assert.equal(isTrustedOrigin(req("DELETE", { referer: "https://evil.example/page" })), false);
});

test("tokens are random and stored only as hashes", () => {
  const a = newToken();
  const b = newToken();
  assert.notEqual(a.token, b.token);
  assert.equal(a.hash, hashToken(a.token));
  assert.notEqual(a.hash, a.token);
  assert.ok(a.token.length >= 40);
});
