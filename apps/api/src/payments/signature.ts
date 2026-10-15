import { createHmac, timingSafeEqual } from "crypto";

function safeEqualHex(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual ?? "", "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Razorpay signs "<order_id>|<payment_id>" with the key secret after a successful checkout.
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

// Webhooks are signed over the exact raw request body with the webhook secret.
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
