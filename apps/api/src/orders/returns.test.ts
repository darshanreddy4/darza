import test from "node:test";
import assert from "node:assert/strict";
import { canRequestReturn, eligibleQty, nextReturnState, orderReturnDeadline, returnableQty, returnDeadline, returnRefund } from "./returns";

const now = new Date("2026-10-20T12:00:00Z");
const delivered = (daysAgo: number) => ({ status: "DELIVERED", deliveredAt: new Date(now.getTime() - daysAgo * 86_400_000) });

test("the deadline is the delivery date plus the window", () => {
  const d = returnDeadline(delivered(0), 7);
  assert.equal(d?.toISOString(), "2026-10-27T12:00:00.000Z");
  assert.equal(returnDeadline({ status: "SHIPPED", deliveredAt: null }, 7), null);
  assert.equal(returnDeadline(delivered(1), 0), null);
});

const line = (over = {}) => ({ quantity: 2, returnedQty: 0, pendingQty: 0, ...over });

test("a delivered order can be returned inside the window only", () => {
  assert.deepEqual(canRequestReturn(delivered(3), 7, [line()], now), { ok: true });
  assert.equal(canRequestReturn(delivered(8), 7, [line()], now).ok, false);
  assert.equal(canRequestReturn(delivered(7), 7, [line()], now).ok, true);
});

test("returns are refused when switched off, undelivered or nothing is left to return", () => {
  assert.match((canRequestReturn(delivered(1), 0, [line()], now) as { reason: string }).reason, /not accepting/);
  assert.match((canRequestReturn({ status: "PAID", deliveredAt: null }, 7, [line()], now) as { reason: string }).reason, /after an order has been delivered/);
  assert.match((canRequestReturn(delivered(1), 7, [line({ returnedQty: 1, pendingQty: 1 })], now) as { reason: string }).reason, /already been returned or is being returned/);
  assert.equal(canRequestReturn(delivered(1), 7, [line({ returnedQty: 2 }), line({ pendingQty: 1 })], now).ok, true);
});

test("units already returned or in a request cannot be requested again", () => {
  assert.equal(returnableQty(line()), 2);
  assert.equal(returnableQty(line({ returnedQty: 1 })), 1);
  assert.equal(returnableQty(line({ returnedQty: 1, pendingQty: 1 })), 0);
});

const order = (over = {}) => ({
  items: [{ id: "a", quantity: 2, pricePaise: 10000, returnedQty: 0 }, { id: "b", quantity: 1, pricePaise: 20000, returnedQty: 0 }],
  discountPaise: 4000, shippingPaise: 5000, totalPaise: 41000, alreadyRefundedPaise: 0, ...over,
});

test("a partial return refunds its share of the discount and keeps the delivery charge", () => {
  // Goods are 40000 with 4000 off, so one 10000 unit carries 1000 of the discount.
  assert.deepEqual(returnRefund(order(), { a: 1 }), { totalPaise: 9000, completesOrder: false });
  assert.deepEqual(returnRefund(order(), { b: 1 }), { totalPaise: 18000, completesOrder: false });
});

test("the return that finishes the order refunds exactly what is left, delivery included", () => {
  assert.deepEqual(returnRefund(order(), { a: 2, b: 1 }), { totalPaise: 41000, completesOrder: true });
  const later = order({ alreadyRefundedPaise: 9000, items: [{ id: "a", quantity: 2, pricePaise: 10000, returnedQty: 1 }, { id: "b", quantity: 1, pricePaise: 20000, returnedQty: 0 }] });
  assert.deepEqual(returnRefund(later, { a: 1, b: 1 }), { totalPaise: 32000, completesOrder: true });
});

test("partial refunds never go past what is left of the goods", () => {
  const nearlyDone = order({ alreadyRefundedPaise: 30000 });
  assert.equal(returnRefund(nearlyDone, { b: 1 }).totalPaise, 6000);
});

test("admin actions follow requested, approved, refunded", () => {
  assert.equal(nextReturnState("REQUESTED", "approve"), "APPROVED");
  assert.equal(nextReturnState("REQUESTED", "refund"), null);
  assert.equal(nextReturnState("APPROVED", "refund"), "REFUNDED");
  assert.equal(nextReturnState("APPROVED", "reject"), "REJECTED");
  assert.equal(nextReturnState("APPROVED", "approve"), null);
  assert.equal(nextReturnState("REJECTED", "approve"), null);
  assert.equal(nextReturnState("REFUNDED", "reject"), null);
});

test("UPI IDs are checked and masked", async () => {
  const { isUpiId, maskUpi } = await import("./returns");
  assert.equal(isUpiId("asha.k@okhdfcbank"), true);
  assert.equal(isUpiId("9876543210@ybl"), true);
  assert.equal(isUpiId("no-at-sign"), false);
  assert.equal(isUpiId("a@b"), false);
  assert.equal(isUpiId("white space@ybl"), false);
  assert.equal(maskUpi("asha.k@okhdfcbank"), "as***@okhdfcbank");
});

test("a payout is due only for a refunded pay-on-delivery return that has not been paid yet", async () => {
  const { payoutDue, nextReturnState: next } = await import("./returns");
  const refunded = { status: "REFUNDED", refundPaise: 5000, paidOutAt: null };
  assert.equal(payoutDue(refunded, "COD"), true);
  assert.equal(payoutDue(refunded, "ONLINE"), false);
  assert.equal(payoutDue({ ...refunded, paidOutAt: new Date() }, "COD"), false);
  assert.equal(payoutDue({ ...refunded, status: "APPROVED" }, "COD"), false);
  assert.equal(payoutDue({ ...refunded, refundPaise: 0 }, "COD"), false);
  assert.equal(next("REFUNDED", "paid"), "REFUNDED");
  assert.equal(next("APPROVED", "paid"), null);
});

test("an item sold as non-returnable can never be put in a return request", () => {
  const fixed = line({ returnDays: 0 });
  assert.equal(eligibleQty(delivered(1), fixed, 7, now), 0);
  assert.equal(eligibleQty(delivered(1), line(), 7, now), 2);
  assert.equal(eligibleQty(delivered(1), line({ returnDays: null }), 7, now), 2);
  const only = canRequestReturn(delivered(1), 7, [fixed], now) as { ok: false; reason: string };
  assert.match(only.reason, /cannot be returned/);
  // A mixed order can still be returned for the items that allow it.
  assert.equal(canRequestReturn(delivered(1), 7, [fixed, line()], now).ok, true);
});

test("each item keeps the window it was sold with", () => {
  const short = line({ returnDays: 3 });
  const long = line({ returnDays: 15 });
  assert.equal(eligibleQty(delivered(5), short, 7, now), 0);
  assert.equal(eligibleQty(delivered(5), long, 7, now), 2);
  assert.equal(canRequestReturn(delivered(5), 7, [short], now).ok, false);
  assert.match((canRequestReturn(delivered(5), 7, [short], now) as { reason: string }).reason, /3-day return window/);
  assert.equal(canRequestReturn(delivered(5), 7, [short, long], now).ok, true);
  assert.equal(orderReturnDeadline(delivered(5), [short, long], 7, now)?.toISOString(), "2026-10-30T12:00:00.000Z");
  assert.equal(orderReturnDeadline(delivered(5), [short], 7, now), null);
});

test("older orders without a saved window use the store's window", () => {
  assert.equal(eligibleQty(delivered(5), line(), 7, now), 2);
  assert.equal(eligibleQty(delivered(8), line(), 7, now), 0);
});
