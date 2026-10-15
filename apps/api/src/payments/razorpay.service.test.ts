import test from "node:test";
import assert from "node:assert/strict";
import { BadGatewayException } from "@nestjs/common";
import { RazorpayService } from "./razorpay.service";

function withFetch(handler: (url: string, init: RequestInit) => Response, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => handler(url, init)) as typeof fetch;
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "secret";
  return run().finally(() => { globalThis.fetch = original; });
}

test("refund posts the amount to the payment's refund endpoint with basic auth", () => {
  let seen: { url: string; body: unknown; auth: string } | undefined;
  return withFetch((url, init) => {
    seen = { url, body: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>).authorization) };
    return new Response(JSON.stringify({ id: "rfnd_1", amount: 4999, status: "processed" }), { status: 200 });
  }, async () => {
    const r = await new RazorpayService().refund("pay_ABC", 4999, "order1");
    assert.equal(r.id, "rfnd_1");
    assert.equal(seen?.url, "https://api.razorpay.com/v1/payments/pay_ABC/refund");
    assert.deepEqual(seen?.body, { amount: 4999, speed: "normal", notes: { orderId: "order1" } });
    assert.equal(seen?.auth, `Basic ${Buffer.from("rzp_test_key:secret").toString("base64")}`);
  });
});

test("a Razorpay error becomes a gateway error that carries their explanation", () =>
  withFetch(() => new Response(JSON.stringify({ error: { description: "The payment has been fully refunded already" } }), { status: 400 }), async () => {
    await assert.rejects(new RazorpayService().refund("pay_ABC", 100, "o"), (e: unknown) => e instanceof BadGatewayException && /fully refunded already/.test((e as Error).message));
  }));

test("a network failure becomes a gateway error", () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
  return assert.rejects(new RazorpayService().refund("pay_ABC", 100, "o"), BadGatewayException).finally(() => { globalThis.fetch = original; });
});
