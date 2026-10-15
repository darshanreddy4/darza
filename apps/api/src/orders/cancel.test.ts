import test from "node:test";
import assert from "node:assert/strict";
import { canCustomerCancel, cancelReasonText } from "./cancel";

test("customers can cancel until the order ships", () => {
  for (const s of ["PENDING_PAYMENT", "PLACED", "PAID"]) assert.equal(canCustomerCancel(s).ok, true, s);
});

test("shipped, delivered, cancelled and refunded orders cannot be cancelled by the customer", () => {
  assert.match((canCustomerCancel("SHIPPED") as { reason: string }).reason, /already shipped/);
  assert.match((canCustomerCancel("DELIVERED") as { reason: string }).reason, /return/);
  assert.match((canCustomerCancel("CANCELLED") as { reason: string }).reason, /already cancelled/);
  assert.equal(canCustomerCancel("REFUNDED").ok, false);
});

test("the stored reason joins the choice and the note and stays short", () => {
  assert.equal(cancelReasonText("Other"), "Other");
  assert.equal(cancelReasonText("Other", "  wrong colour "), "Other: wrong colour");
  assert.equal(cancelReasonText("Other", "x".repeat(500)).length, 300);
});
