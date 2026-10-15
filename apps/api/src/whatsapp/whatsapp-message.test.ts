import test from "node:test";
import assert from "node:assert/strict";
import { orderUpdateSentence, templateParams, whatsAppNumber } from "./whatsapp-message";

test("each status has its own plain sentence", () => {
  assert.match(orderUpdateSentence("placed", { totalPaise: 149900, refundIssued: false }), /order for ₹1,499\. You'll pay when it's delivered/);
  assert.match(orderUpdateSentence("shipped", { totalPaise: 0, refundIssued: false }), /shipped/);
  assert.match(orderUpdateSentence("delivered", { totalPaise: 0, refundIssued: false }), /delivered/);
});

test("refund wording depends on whether money is going back", () => {
  assert.match(orderUpdateSentence("cancelled", { totalPaise: 59900, refundIssued: true }), /₹599 is being refunded/);
  assert.equal(orderUpdateSentence("cancelled", { totalPaise: 59900, refundIssued: false }), "your order was cancelled.");
  assert.match(orderUpdateSentence("refunded", { totalPaise: 59900, refundIssued: true }), /refunded ₹599/);
});

test("the template gets name, order, update and link in order", () => {
  const p = templateParams("shipped", { name: "Asha", orderRef: "#ABC12345", totalPaise: 100, refundIssued: false, url: "https://shop.example/orders" });
  assert.equal(p.length, 4);
  assert.deepEqual([p[0], p[1], p[3]], ["Asha", "#ABC12345", "https://shop.example/orders"]);
});

test("the number is sent as digits", () => {
  assert.equal(whatsAppNumber("+919876543210"), "919876543210");
});
