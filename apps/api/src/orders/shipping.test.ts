import { test } from "node:test";
import assert from "node:assert/strict";
import { bulkTrackingError, collectPaise, parseIds, planBulkShip, readyToShip, trackingLink } from "./shipping";

test("only confirmed and paid orders are ready to pack", () => {
  assert.equal(readyToShip("PLACED"), true);
  assert.equal(readyToShip("PAID"), true);
  for (const s of ["PENDING_PAYMENT", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const) assert.equal(readyToShip(s), false, s);
});

test("the courier collects cash for pay on delivery and the balance of a part payment", () => {
  assert.equal(collectPaise({ paymentMethod: "COD", totalPaise: 50000, advancePaise: 0 }), 50000);
  assert.equal(collectPaise({ paymentMethod: "ONLINE", totalPaise: 50000, advancePaise: 15000 }), 35000);
  assert.equal(collectPaise({ paymentMethod: "ONLINE", totalPaise: 50000, advancePaise: 0 }), 0);
  assert.equal(collectPaise({ paymentMethod: "ONLINE", totalPaise: 100, advancePaise: 500 }), 0);
});

test("a bulk ship plan separates ready orders from the rest, with reasons", () => {
  const found = [
    { id: "a", status: "PLACED" as const }, { id: "b", status: "SHIPPED" as const }, { id: "c", status: "PENDING_PAYMENT" as const },
    { id: "d", status: "PAID" as const }, { id: "e", status: "CANCELLED" as const },
  ];
  const plan = planBulkShip(found, ["a", "b", "c", "d", "e", "zzz", "a"]);
  assert.deepEqual(plan.ready, ["a", "d"]);
  assert.deepEqual(plan.skipped, [
    { id: "b", reason: "Already shipped" }, { id: "c", reason: "Waiting for payment" }, { id: "e", reason: "Cancelled" }, { id: "zzz", reason: "Order not found" },
  ]);
});

test("ids from a query are cleaned, de-duplicated and capped", () => {
  assert.deepEqual(parseIds("abcdefghij12, abcdefghij12,short,bad id!!!!!"), ["abcdefghij12"]);
  assert.deepEqual(parseIds(""), []);
  const many = Array.from({ length: 80 }, (_, i) => `order${String(i).padStart(8, "0")}`).join(",");
  assert.equal(parseIds(many).length, 50);
});

test("a tracking link template gets each parcel's number", () => {
  assert.equal(trackingLink("https://courier.example/track/{number}", "AB 12"), "https://courier.example/track/AB%2012");
  assert.equal(trackingLink("https://courier.example/t?a={number}&b={number}", "X1"), "https://courier.example/t?a=X1&b=X1");
  assert.equal(trackingLink(undefined, "X1"), undefined);
  assert.equal(trackingLink("https://courier.example/track/{number}", undefined), undefined);
});

test("bulk tracking numbers are checked before anything ships", () => {
  const a = { id: "order00000001aaaa", trackingNumber: "TRK100" };
  const b = { id: "order00000002bbbb", trackingNumber: "TRK200" };
  assert.equal(bulkTrackingError("Delhivery", [a, b], "https://c.example/{number}"), null);
  assert.equal(bulkTrackingError(undefined, [], undefined), null);
  assert.match(bulkTrackingError(undefined, [a], undefined)!, /courier name/);
  assert.match(bulkTrackingError("Delhivery", [a], "http://c.example/{number}")!, /https:\/\//);
  assert.match(bulkTrackingError("Delhivery", [a], "https://c.example/track")!, /\{number\}/);
  assert.match(bulkTrackingError(undefined, [], "https://c.example/{number}")!, /courier name/);
  assert.match(bulkTrackingError("Delhivery", [a, { ...b, trackingNumber: "trk100" }], undefined)!, /on both #AAAA|on both #.*AAAA/);
  assert.match(bulkTrackingError("Delhivery", [{ ...a, trackingNumber: "bad!" }], undefined)!, /#[A-Z0-9]{8}: The tracking number can only/);
  assert.equal(bulkTrackingError("Delhivery", [{ ...a, trackingNumber: "  " }], undefined), null);
});
