import test from "node:test";
import assert from "node:assert/strict";
import { deliveryByDate, publicCardFields } from "./card-options";

test("delivery date counts calendar days from today in India", () => {
  // 10 Oct 2026 20:00 UTC is already 11 Oct 01:30 in India.
  const now = new Date("2026-10-10T20:00:00Z");
  assert.equal(deliveryByDate(0, now), "2026-10-11");
  assert.equal(deliveryByDate(3, now), "2026-10-14");
});

test("delivery date rolls over month and year ends", () => {
  assert.equal(deliveryByDate(2, new Date("2026-12-30T06:00:00Z")), "2027-01-01");
  assert.equal(deliveryByDate(1, new Date("2026-02-27T06:00:00Z")), "2026-02-28");
});

test("DMG products expose cart and delivery date when enabled", () => {
  const now = new Date("2026-10-10T06:00:00Z");
  assert.deepEqual(publicCardFields({ productType: "OWN", showAddToCart: true, deliveryDays: 4 }, now), { showAddToCart: true, deliveryBy: "2026-10-14" });
  assert.deepEqual(publicCardFields({ productType: "OWN", showAddToCart: false, deliveryDays: null }, now), { showAddToCart: false, deliveryBy: null });
});

test("a zero-day delivery still counts as set", () => {
  assert.equal(publicCardFields({ productType: "OWN", showAddToCart: false, deliveryDays: 0 }, new Date("2026-10-10T06:00:00Z")).deliveryBy, "2026-10-10");
});

test("partner products never show cart or delivery", () => {
  assert.deepEqual(publicCardFields({ productType: "AFFILIATE", showAddToCart: true, deliveryDays: 2 }), { showAddToCart: false, deliveryBy: null });
});
