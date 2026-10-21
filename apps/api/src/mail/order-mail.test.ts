import test from "node:test";
import assert from "node:assert/strict";
import { orderMail, type OrderMailData } from "./order-mail";

const data: OrderMailData = {
  brand: "Acme", name: "Asha <b>", orderRef: "#ABC12345", items: [{ name: "Charger", quantity: 2, pricePaise: 59900 }],
  subtotalPaise: 119800, discountPaise: 10000, shippingPaise: 0, totalPaise: 109800, couponCode: "DIWALI10", paymentMethod: "ONLINE", refundIssued: true, url: "https://shop.example/orders",
};

test("confirmation lists items, discount, free delivery and total", () => {
  const m = orderMail("paid", data);
  assert.match(m.subject, /Payment received for order #ABC12345/);
  assert.match(m.text, /Charger x 2/);
  assert.match(m.text, /Discount \(DIWALI10\): -₹100/);
  assert.match(m.text, /Delivery: Free/);
  assert.match(m.text, /Total: ₹1,098/);
});

test("customer-supplied text is escaped in the HTML", () => {
  assert.ok(!orderMail("placed", data).html.includes("<b>"));
  assert.ok(orderMail("placed", data).html.includes("Asha &lt;b&gt;"));
});

test("the shipped email carries the courier, tracking number and link, escaped", () => {
  const m = orderMail("shipped", { ...data, tracking: { courier: "Blue <i>Dart", number: "7712345", url: "https://courier.example/t/7712345" } });
  assert.match(m.text, /Courier: Blue <i>Dart\nTracking number: 7712345\nTrack your shipment: https:\/\/courier\.example\/t\/7712345/);
  assert.ok(m.html.includes("Blue &lt;i&gt;Dart") && m.html.includes('href="https://courier.example/t/7712345"'));
  assert.ok(!orderMail("shipped", { ...data, tracking: { courier: "Self delivery", number: null, url: "javascript:alert(1)" } }).html.includes("javascript:"));
  assert.doesNotMatch(orderMail("shipped", data).text, /Courier/);
});

test("cancelled and refunded emails mention the refund only when one was issued", () => {
  assert.match(orderMail("cancelled", data).text, /started a refund of ₹1,098/);
  assert.doesNotMatch(orderMail("cancelled", { ...data, refundIssued: false }).text, /refund/i);
  assert.match(orderMail("refunded", data).subject, /Refund for order/);
});

test("the brand name is used in the subject and sign-off", () => {
  const shipped = orderMail("shipped", data);
  assert.equal(shipped.subject, "Your Acme order #ABC12345 has shipped");
  assert.match(shipped.text, /- Acme$/);
});
