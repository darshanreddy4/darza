import test from "node:test";
import assert from "node:assert/strict";
import { unsubscribeToken, userFromUnsubscribeToken } from "./unsubscribe";

test("a token gives back the user it was made for", () => {
  assert.equal(userFromUnsubscribeToken(unsubscribeToken("user_123", "s3cret"), "s3cret"), "user_123");
});

test("tampered, foreign or malformed tokens are rejected", () => {
  const token = unsubscribeToken("user_123", "s3cret");
  const [, mac] = token.split(".");
  assert.equal(userFromUnsubscribeToken(token, "other-secret"), null);
  assert.equal(userFromUnsubscribeToken(`${Buffer.from("user_999").toString("base64url")}.${mac}`, "s3cret"), null);
  assert.equal(userFromUnsubscribeToken("nonsense", "s3cret"), null);
  assert.equal(userFromUnsubscribeToken(`${token}.x`, "s3cret"), null);
  assert.equal(userFromUnsubscribeToken("", "s3cret"), null);
});
