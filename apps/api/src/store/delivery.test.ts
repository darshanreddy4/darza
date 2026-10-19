import test from "node:test";
import assert from "node:assert/strict";
import { parseGifts, parseZones, priceBasket, zoneFor, type DeliveryLine, type DeliveryRules, type DeliveryZone } from "./delivery";

const rules: DeliveryRules = { shippingFeePaise: 4900, freeShippingOverPaise: 49900, freeAllOverPaise: 150000 };
const regular = (goodsPaise: number): DeliveryLine => ({ goodsPaise, mode: "STORE", feePaise: null });
const heavy = (goodsPaise: number, feePaise: number | null = 29900): DeliveryLine => ({ goodsPaise, mode: "CHARGE", feePaise });
const free = (goodsPaise: number): DeliveryLine => ({ goodsPaise, mode: "FREE", feePaise: null });
const price = (lines: DeliveryLine[], over: Partial<Parameters<typeof priceBasket>[0]> = {}) => priceBasket({ lines, discountPaise: 0, rules, ...over });

test("scenario 1: regular items ship free once they reach the free-delivery amount", () => {
  assert.equal(price([regular(49899)]).shippingPaise, 4900);
  assert.equal(price([regular(49900)]).shippingPaise, 0);
  assert.equal(price([regular(49900)]).delivery.freeBecause, "THRESHOLD");
  assert.equal(price([regular(100)], { rules: { ...rules, shippingFeePaise: 0 } }).shippingPaise, 0);
  assert.equal(price([regular(10_000_000)], { rules: { ...rules, freeShippingOverPaise: null, freeAllOverPaise: null } }).shippingPaise, 4900);
  assert.equal(price([]).shippingPaise, 0);
});

test("a coupon lowers what is paid, not the cart value that earns free delivery or gifts", () => {
  const r = price([regular(54000)], { discountPaise: 5000 });
  assert.deepEqual([r.subtotalPaise, r.discountPaise, r.shippingPaise, r.totalPaise, r.freeShippingGapPaise], [54000, 5000, 0, 49000, 0]);
  assert.equal(r.delivery.freeBecause, "THRESHOLD");
  assert.equal(price([regular(1000)], { discountPaise: 5000 }).discountPaise, 1000);
  // Under the amount before the coupon stays under it, and the gap is measured on the cart value.
  assert.equal(price([regular(40000)], { discountPaise: 5000 }).freeShippingGapPaise, 9900);
  const gift = price([regular(100000)], { discountPaise: 30000, gifts: [{ atPaise: 100000, title: "Tote" }] });
  assert.deepEqual(gift.earnedGifts, ["Tote"]);
});

test("scenario 2: a heavy item always pays delivery, its own fee or the store's", () => {
  assert.equal(price([heavy(10000)]).shippingPaise, 29900);
  assert.equal(price([heavy(10000, null)]).shippingPaise, 4900);
  // Spending a lot is not enough: only the free-everything amount waives it.
  assert.equal(price([heavy(120000)]).shippingPaise, 29900);
  assert.equal(price([heavy(10000), heavy(20000, 5000)]).shippingPaise, 34900);
});

test("scenario 3: a big regular item does not make a heavy item free, only the heavy item is charged", () => {
  const r = price([regular(60000), heavy(20000)]);
  assert.equal(r.shippingPaise, 29900);
  assert.equal(r.delivery.standardPaise, 0);
  assert.equal(r.delivery.specialPaise, 29900);
  assert.equal(r.totalPaise, 80000 + 29900);
  // Without enough regular goods both are charged.
  assert.equal(price([regular(10000), heavy(20000)]).shippingPaise, 29900 + 4900);
});

test("a heavy item's money counts towards the free-delivery amount of regular items, but it is still charged", () => {
  const r = price([regular(30000), heavy(40000, 1000)]);
  assert.equal(r.delivery.standardPaise, 0);
  assert.equal(r.shippingPaise, 1000);
  // The small regular item gets free delivery from the big heavy purchase, as the cart said it would.
  const cart = price([regular(36000), heavy(436000, 5000)], { rules: { ...rules, freeAllOverPaise: null } });
  assert.deepEqual([cart.delivery.standardPaise, cart.shippingPaise, cart.freeShippingGapPaise], [0, 5000, 0]);
});

test("scenario 4: once the whole basket passes the free-everything amount all delivery is free", () => {
  const r = price([regular(100000), heavy(60000)]);
  assert.equal(r.shippingPaise, 0);
  assert.equal(r.delivery.freeBecause, "ALL");
  assert.equal(price([regular(100000), heavy(49999)]).shippingPaise, 29900);
  assert.equal(price([heavy(150000)]).shippingPaise, 0);
  // The coupon does not undo it.
  assert.equal(price([regular(100000), heavy(60000)], { discountPaise: 20000 }).shippingPaise, 0);
});

test("free-delivery items cost nothing and count towards regular items' amount", () => {
  assert.equal(price([free(500)]).shippingPaise, 0);
  assert.equal(price([free(30000), regular(25000)]).shippingPaise, 0);
  assert.equal(price([free(30000), regular(1000)]).shippingPaise, 4900);
  assert.equal(price([free(30000), heavy(1000)]).shippingPaise, 29900);
});

const zones: DeliveryZone[] = [
  { name: "North East", pincodes: ["79", "78"], feePaise: 9900, freeOverPaise: null },
  { name: "Imphal", pincodes: ["795001"], feePaise: 14900, freeOverPaise: 200000 },
];

test("a PIN code picks the zone with the longest matching start", () => {
  assert.equal(zoneFor(zones, "794001")?.name, "North East");
  assert.equal(zoneFor(zones, "795001")?.name, "Imphal");
  assert.equal(zoneFor(zones, "411001"), null);
  assert.equal(zoneFor(zones, "12"), null);
  assert.equal(zoneFor(zones, undefined), null);
});

test("an area's fee replaces the store fee and may never be free by amount", () => {
  const ne = zoneFor(zones, "794001");
  assert.equal(price([regular(100000)], { zone: ne }).shippingPaise, 9900);
  assert.equal(price([regular(100000)]).shippingPaise, 0);
  // A heavy item without its own fee pays the area's fee.
  assert.equal(price([heavy(1000, null)], { zone: ne }).shippingPaise, 9900);
  // The free-everything amount still applies.
  assert.equal(price([regular(160000)], { zone: ne }).shippingPaise, 0);
  const imphal = zoneFor(zones, "795001");
  assert.equal(price([regular(150000)], { zone: imphal, rules: { ...rules, freeAllOverPaise: null } }).shippingPaise, 14900);
  assert.equal(price([regular(200000)], { zone: imphal, rules: { ...rules, freeAllOverPaise: null } }).shippingPaise, 0);
});

test("the progress bar lists what is left to unlock, in order", () => {
  const gifts = [{ atPaise: 100000, title: "Tote bag" }];
  const r = price([regular(30000)], { gifts });
  assert.deepEqual(r.rewards.milestones.map((m) => [m.kind, m.atPaise, m.reached]), [["delivery", 49900, false], ["gift", 100000, false]]);
  assert.deepEqual(r.rewards.next, { title: "Free delivery", remainingPaise: 19900 });
  assert.deepEqual(r.earnedGifts, []);

  const big = price([regular(120000)], { gifts });
  assert.deepEqual(big.rewards.milestones.map((m) => m.reached), [true, true]);
  assert.equal(big.rewards.next, null);
  assert.deepEqual(big.earnedGifts, ["Tote bag"]);
});

test("with a heavy item in the basket the bar shows both delivery goals", () => {
  const r = price([regular(20000), heavy(20000, 10000)]);
  assert.equal(r.shippingPaise, 14900);
  assert.deepEqual(r.rewards.milestones.map((m) => [m.kind, m.title, m.atPaise]), [
    ["delivery", "Free delivery on your other items", 49900],
    ["delivery-all", "Free delivery on everything", 150000],
  ]);
  assert.equal(r.delivery.freeAllGapPaise, 110000);
});

test("no goals are shown when nothing is charged", () => {
  assert.deepEqual(price([free(1000)]).rewards.milestones, []);
  assert.deepEqual(price([regular(100)], { rules: { shippingFeePaise: 0, freeShippingOverPaise: null, freeAllOverPaise: null } }).rewards.milestones, []);
});

test("saved zones and gifts that are malformed are ignored", () => {
  assert.deepEqual(parseZones([{ name: "A", pincodes: ["79", "x", "0123"], feePaise: 100, freeOverPaise: null }, { name: "B" }, null, "z"]), [{ name: "A", pincodes: ["79"], feePaise: 100, freeOverPaise: null }]);
  assert.deepEqual(parseGifts([{ atPaise: 500, title: "B" }, { atPaise: 100, title: "A" }, { atPaise: -1, title: "C" }, { title: "D" }]), [{ atPaise: 100, title: "A" }, { atPaise: 500, title: "B" }]);
  assert.deepEqual(parseZones("nope"), []);
});

test("a percentage reward takes money off the whole order once the cart value reaches it, and only the best one applies", () => {
  const gifts = [
    { atPaise: 100000, title: "5% off your order", kind: "PERCENT" as const, percent: 5 },
    { atPaise: 200000, title: "10% off your order", kind: "PERCENT" as const, percent: 10, maxPaise: 15000 },
    { atPaise: 300000, title: "Surprise gift" },
  ];
  const under = price([regular(90000)], { gifts });
  assert.deepEqual([under.rewardDiscountPaise, under.totalPaise], [0, 90000]);
  const five = price([regular(120000)], { gifts });
  assert.deepEqual([five.rewardDiscountPaise, five.rewardTitle, five.totalPaise], [6000, "5% off your order", 114000]);
  // 10% of 250000 is 25000 but the cap is 15000.
  const ten = price([regular(250000)], { gifts });
  assert.deepEqual([ten.rewardDiscountPaise, ten.totalPaise, ten.earnedGifts], [15000, 235000, []]);
  // A coupon then works on what is left and the two can never take more than the goods.
  const both = price([regular(120000)], { gifts, discountPaise: 500000 });
  assert.deepEqual([both.rewardDiscountPaise, both.discountPaise, both.totalPaise], [6000, 114000, 0]);
  // The bar lists percentage rewards as discounts and gifts as gifts.
  assert.deepEqual(under.rewards.milestones.filter((m) => m.kind !== "delivery").map((m) => m.kind), ["discount", "discount", "gift"]);
  assert.equal(price([regular(310000)], { gifts }).earnedGifts[0], "Surprise gift");
});

test("percentage rewards are read back from saved settings, and bad ones are ignored", () => {
  assert.deepEqual(parseGifts([{ atPaise: 100, title: "5% off", kind: "PERCENT", percent: 5, maxPaise: 300 }, { atPaise: 200, title: "x", kind: "PERCENT", percent: 0 }, { atPaise: 300, title: "x", kind: "PERCENT", percent: 95 }]),
    [{ atPaise: 100, title: "5% off", kind: "PERCENT", percent: 5, maxPaise: 300 }]);
});

test("codes the shopper can unlock appear on the same bar, in order of the amount to spend", () => {
  const coupons = [{ title: "₹50 off with code DIWALI60", atPaise: 30000, reached: false }, { title: "10% off with code BIG", atPaise: 90000, reached: false }];
  const r = price([regular(20000)], { coupons });
  assert.deepEqual(r.rewards.milestones.map((m) => [m.kind, m.atPaise, m.reached]), [["coupon", 30000, false], ["delivery", 49900, false], ["coupon", 90000, false]]);
  assert.deepEqual(r.rewards.next, { title: "₹50 off with code DIWALI60", remainingPaise: 10000 });
  const unlocked = price([regular(20000)], { coupons: [{ ...coupons[0], reached: true }] });
  assert.deepEqual(unlocked.rewards.next, { title: "Free delivery", remainingPaise: 29900 });
  // Nothing to show on an empty basket.
  assert.deepEqual(price([], { coupons }).rewards.milestones, []);
});
