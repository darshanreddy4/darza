import assert from "node:assert/strict";
import test from "node:test";
import { hasTracking, NO_TRACKING, readTracking, trackingText } from "./tracking";

test("tracking is optional, and cleaned when given", () => {
  assert.deepEqual(readTracking(undefined), { tracking: NO_TRACKING });
  assert.equal(hasTracking(readTracking({}).tracking), false);
  const r = readTracking({ courierName: "  Blue   Dart ", trackingNumber: " 7712 3456 ", trackingUrl: " https://courier.example/t/7712 " });
  assert.deepEqual(r, { tracking: { courierName: "Blue Dart", trackingNumber: "7712 3456", trackingUrl: "https://courier.example/t/7712" } });
});

test("a courier alone is fine; a number or link needs the courier", () => {
  assert.equal(readTracking({ courierName: "Self delivery" }).error, undefined);
  assert.ok(readTracking({ trackingNumber: "ABC123" }).error?.includes("courier"));
  assert.ok(readTracking({ trackingUrl: "https://courier.example/t" }).error?.includes("courier"));
});

test("links must be https and numbers plain", () => {
  assert.ok(readTracking({ courierName: "X", trackingUrl: "http://courier.example/t" }).error?.includes("https://"));
  assert.ok(readTracking({ courierName: "X", trackingUrl: "javascript:alert(1)" }).error?.includes("https://"));
  assert.ok(readTracking({ courierName: "X", trackingNumber: "<script>" }).error?.includes("tracking number"));
  assert.ok(readTracking({ courierName: "X".repeat(61) }).error?.includes("too long"));
});

test("a short text for messages", () => {
  assert.equal(trackingText({ courierName: "Delhivery", trackingNumber: "1234567" }), "Delhivery 1234567");
  assert.equal(trackingText({ courierName: "Self delivery", trackingNumber: null }), "Self delivery");
  assert.equal(trackingText(NO_TRACKING), "");
});
