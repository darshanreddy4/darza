import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { verifyCheckoutSignature, verifyWebhookSignature } from "./signature";

const sign = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("hex");

test("accepts a valid checkout signature", () => {
  assert.ok(verifyCheckoutSignature("order_1", "pay_1", sign("order_1|pay_1", "s3cret"), "s3cret"));
});

test("rejects tampered ids, wrong secret and malformed signatures", () => {
  const good = sign("order_1|pay_1", "s3cret");
  assert.equal(verifyCheckoutSignature("order_1", "pay_2", good, "s3cret"), false);
  assert.equal(verifyCheckoutSignature("order_1", "pay_1", good, "other"), false);
  assert.equal(verifyCheckoutSignature("order_1", "pay_1", "abc", "s3cret"), false);
  assert.equal(verifyCheckoutSignature("order_1", "pay_1", "", "s3cret"), false);
});

test("verifies webhook signatures over the raw body", () => {
  const body = Buffer.from('{"event":"payment.captured"}');
  assert.ok(verifyWebhookSignature(body, sign(body.toString(), "wh"), "wh"));
  assert.equal(verifyWebhookSignature(Buffer.from('{"event":"x"}'), sign(body.toString(), "wh"), "wh"), false);
});
