import { test } from "node:test";
import assert from "node:assert/strict";
import { guestDeliveryAdvance, guestRulesOf } from "./guest";

const rules = { checkoutEnabled: true, codEnabled: true, minAdvancePaise: 5000 };
const cod = { allowed: true, feePaise: 0, reason: null };
const base = { rules, cod, deliveryPaise: 6000, orderPaise: 100000, productPercent: 0 };

test("a guest pays the delivery charge online and the rest on delivery", () => {
  assert.deepEqual(guestDeliveryAdvance(base), { allowed: true, reason: null, advancePaise: 6000, balancePaise: 94000, totalPaise: 100000 });
});

test("the pay-on-delivery fee is paid online too and is part of the total", () => {
  const offer = guestDeliveryAdvance({ ...base, cod: { allowed: true, feePaise: 4000, reason: null } });
  assert.deepEqual([offer.advancePaise, offer.balancePaise, offer.totalPaise], [10000, 94000, 104000]);
});

test("free delivery still takes the store's minimum online", () => {
  const offer = guestDeliveryAdvance({ ...base, deliveryPaise: 0 });
  assert.equal(offer.advancePaise, 5000);
  assert.equal(offer.balancePaise, 95000);
});

test("a product sold with part payment raises the amount paid online to its share", () => {
  const offer = guestDeliveryAdvance({ ...base, productPercent: 30 });
  assert.equal(offer.advancePaise, 30000);
});

test("it is refused when nothing would be left to pay on delivery", () => {
  const offer = guestDeliveryAdvance({ ...base, orderPaise: 5000, deliveryPaise: 0 });
  assert.equal(offer.allowed, false);
  assert.match(offer.reason!, /nothing left to pay on delivery/);
});

test("it follows the store's switch and the shop's own pay-on-delivery rules", () => {
  assert.match(guestDeliveryAdvance({ ...base, rules: { ...rules, codEnabled: false } }).reason!, /isn't offered to guests/);
  const blocked = guestDeliveryAdvance({ ...base, cod: { allowed: false, feePaise: 0, reason: "Pay on delivery is available for orders up to ₹5,000. Please pay online." } });
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason!, /up to ₹5,000/);
  assert.equal(guestDeliveryAdvance({ ...base, orderPaise: 0 }).allowed, false);
});

test("the store's settings turn into rules", () => {
  assert.deepEqual(guestRulesOf({ guestCheckoutEnabled: true, guestCodEnabled: false, guestMinAdvancePaise: 100 }), { checkoutEnabled: true, codEnabled: false, minAdvancePaise: 100 });
});

test("the share a basket asks for is the highest one, and nothing when part payment is off", async () => {
  const { guestShare } = await import("./guest");
  const lines = [{ onlineOnly: false, advancePercent: 30 }, { onlineOnly: false, advancePercent: 40 }, { onlineOnly: false, advancePercent: null }];
  assert.equal(guestShare(true, lines), 40);
  assert.equal(guestShare(false, lines), 0);
  assert.equal(guestShare(true, [{ onlineOnly: true, advancePercent: 50 }]), 0);
});
