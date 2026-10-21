import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCoupon, normalizeCouponCode, type CouponLike } from "./coupon-rules";
import { allocateDiscount, buildInvoice, financialYear, formatInvoiceNumber } from "./invoice";

const coupon = (over: Partial<CouponLike> = {}): CouponLike => ({
  type: "PERCENT", value: 10, minOrderPaise: 0, maxDiscountPaise: null, startsAt: null, endsAt: null, usageLimit: null, perUserLimit: null, active: true, ...over,
});
const ctx = (over = {}) => ({ subtotalPaise: 100000, now: new Date("2026-10-12T10:00:00Z"), usedTotal: 0, usedByUser: 0, ...over });

test("percent coupons round down and respect the cap", () => {
  assert.deepEqual(evaluateCoupon(coupon(), ctx()), { ok: true, discountPaise: 10000 });
  assert.deepEqual(evaluateCoupon(coupon({ value: 15 }), ctx({ subtotalPaise: 9999 })), { ok: true, discountPaise: 1499 });
  assert.deepEqual(evaluateCoupon(coupon({ value: 50, maxDiscountPaise: 20000 }), ctx()), { ok: true, discountPaise: 20000 });
});

test("flat coupons never exceed the cart", () => {
  assert.deepEqual(evaluateCoupon(coupon({ type: "FLAT", value: 15000 }), ctx()), { ok: true, discountPaise: 15000 });
  assert.deepEqual(evaluateCoupon(coupon({ type: "FLAT", value: 15000 }), ctx({ subtotalPaise: 9000 })), { ok: true, discountPaise: 9000 });
});

test("coupon eligibility rules explain themselves", () => {
  const reason = (c: CouponLike, x = ctx()) => { const r = evaluateCoupon(c, x); return r.ok ? "ok" : r.reason; };
  assert.match(reason(coupon({ active: false })), /not active/);
  assert.match(reason(coupon({ startsAt: new Date("2026-11-01") })), /not valid yet/);
  assert.match(reason(coupon({ endsAt: new Date("2026-10-01") })), /expired/);
  assert.match(reason(coupon({ usageLimit: 5 }), ctx({ usedTotal: 5 })), /usage limit/);
  assert.match(reason(coupon({ perUserLimit: 1 }), ctx({ usedByUser: 1 })), /already used/);
  assert.match(reason(coupon({ minOrderPaise: 150000 })), /Add ₹500 more/);
  assert.equal(reason(coupon({ usageLimit: 5 }), ctx({ usedTotal: 4 })), "ok");
});

test("codes are compared in upper case", () => {
  assert.equal(normalizeCouponCode("  diwali10 "), "DIWALI10");
});

test("a discount is split across lines to the paisa", () => {
  assert.deepEqual(allocateDiscount([10000, 10000, 10000], 100), [34, 33, 33]);
  assert.deepEqual(allocateDiscount([30000, 10000], 1000), [750, 250]);
  assert.deepEqual(allocateDiscount([5000], 0), [0]);
  const parts = allocateDiscount([3333, 6667, 1], 777);
  assert.equal(parts.reduce((a, b) => a + b, 0), 777);
});

const items = [
  { name: "Charger", quantity: 2, unitPaise: 59000, gstRatePercent: 18 },
  { name: "Cable", quantity: 1, unitPaise: 10500, gstRatePercent: 5 },
];

test("bill of supply carries no tax", () => {
  const inv = buildInvoice({ items, discountPaise: 0, shippingPaise: 4900, shippingGstPercent: 18, gstApplied: false, intraState: true });
  assert.equal(inv.totals.totalPaise, 118000 + 10500 + 4900);
  assert.equal(inv.totals.cgstPaise + inv.totals.sgstPaise + inv.totals.igstPaise, 0);
  assert.ok(inv.lines.every((l) => l.gstRatePercent === 0 && l.taxablePaise === l.amountPaise));
});

test("same-state sales split GST into CGST and SGST", () => {
  const inv = buildInvoice({ items, discountPaise: 0, shippingPaise: 0, shippingGstPercent: 18, gstApplied: true, intraState: true });
  const charger = inv.lines[0];
  assert.equal(charger.taxablePaise, 100000);
  assert.equal(charger.cgstPaise, 9000);
  assert.equal(charger.sgstPaise, 9000);
  assert.equal(charger.igstPaise, 0);
  // 10,500 at 5% inclusive: 10,000 taxable, 500 tax.
  assert.equal(inv.lines[1].taxablePaise, 10000);
  assert.equal(inv.lines[1].cgstPaise + inv.lines[1].sgstPaise, 500);
});

test("each line carries its HSN code, and delivery has none", () => {
  const inv = buildInvoice({ items: [{ ...items[0], hsnCode: "850440" }, items[1]], discountPaise: 0, shippingPaise: 4900, shippingGstPercent: 18, gstApplied: true, intraState: true });
  assert.deepEqual(inv.lines.map((l) => l.hsnCode), ["850440", null, null]);
});

test("other-state sales charge IGST", () => {
  const inv = buildInvoice({ items, discountPaise: 0, shippingPaise: 0, shippingGstPercent: 18, gstApplied: true, intraState: false });
  assert.equal(inv.lines[0].igstPaise, 18000);
  assert.equal(inv.totals.cgstPaise + inv.totals.sgstPaise, 0);
});

test("taxable value plus tax always equals what was paid, with discount and delivery", () => {
  const inv = buildInvoice({ items, discountPaise: 12345, shippingPaise: 4900, shippingGstPercent: 18, gstApplied: true, intraState: true });
  const t = inv.totals;
  assert.equal(t.taxablePaise + t.cgstPaise + t.sgstPaise + t.igstPaise, t.totalPaise);
  assert.equal(t.totalPaise, 118000 + 10500 - 12345 + 4900);
  assert.equal(t.discountPaise, 12345);
  assert.equal(inv.lines.at(-1)?.description, "Delivery charge");
});

test("financial year and invoice numbers", () => {
  assert.equal(financialYear(new Date("2026-10-12T10:00:00Z")), "2026-27");
  assert.equal(financialYear(new Date("2027-03-31T10:00:00Z")), "2026-27");
  // 31 March 20:00 UTC is already 1 April in India.
  assert.equal(financialYear(new Date("2027-03-31T20:00:00Z")), "2027-28");
  assert.equal(formatInvoiceNumber("DZ", new Date("2026-10-12T10:00:00Z"), 42), "DZ/2026-27/00042");
});

test("a code for chosen customers works only for them", () => {
  const personal = coupon({ customerIds: ["u1", "u3"] });
  assert.deepEqual(evaluateCoupon(personal, ctx({ userId: "u1" })), { ok: true, discountPaise: 10000 });
  assert.deepEqual(evaluateCoupon(personal, ctx({ userId: "u3" })), { ok: true, discountPaise: 10000 });
  assert.deepEqual(evaluateCoupon(personal, ctx({ userId: "u2" })), { ok: false, reason: "This code is not valid for your account" });
  assert.deepEqual(evaluateCoupon(personal, ctx()), { ok: false, reason: "Log in to use this code" });
  // No chosen customers means everyone.
  assert.equal(evaluateCoupon(coupon({ customerIds: [] }), ctx()).ok, true);
});

test("a one-use-per-customer code is also used up by the same email or phone on another account", () => {
  const once = coupon({ perUserLimit: 1 });
  assert.equal(evaluateCoupon(once, ctx({ userId: "u1", usedByUser: 0, usedByIdentity: 0 })).ok, true);
  assert.deepEqual(evaluateCoupon(once, ctx({ userId: "u1", usedByUser: 1, usedByIdentity: 1 })), { ok: false, reason: "You have already used this code" });
  assert.deepEqual(evaluateCoupon(once, ctx({ userId: "u2", usedByUser: 0, usedByIdentity: 1 })), { ok: false, reason: "This code has already been used with your email address or mobile number" });
  assert.equal(evaluateCoupon(coupon({ perUserLimit: 2 }), ctx({ userId: "u2", usedByUser: 0, usedByIdentity: 1 })).ok, true);
});

test("a first-order code is refused once the customer has ordered", () => {
  const first = coupon({ firstOrderOnly: true });
  assert.equal(evaluateCoupon(first, ctx({ ordersBefore: 0 })).ok, true);
  assert.deepEqual(evaluateCoupon(first, ctx({ ordersBefore: 1 })), { ok: false, reason: "This code is for your first order only" });
  // A guest has no history yet; the check happens again when they place the order.
  assert.equal(evaluateCoupon(first, ctx()).ok, true);
});
