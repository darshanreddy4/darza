import test from "node:test";
import assert from "node:assert/strict";
import { deletionBlocker } from "./account-rules";

const base = { role: "CUSTOMER", orderStatuses: ["DELIVERED", "CANCELLED", "REFUNDED"], openReturns: 0, payoutsDue: 0 };

test("a customer with nothing in progress can delete their account", () => {
  assert.equal(deletionBlocker(base), null);
  assert.equal(deletionBlocker({ ...base, orderStatuses: [] }), null);
});

test("orders on their way, open returns and unpaid refunds block deletion", () => {
  for (const s of ["PENDING_PAYMENT", "PLACED", "PAID", "SHIPPED"]) assert.match(deletionBlocker({ ...base, orderStatuses: [s] }) ?? "", /not been delivered/, s);
  assert.match(deletionBlocker({ ...base, openReturns: 1 }) ?? "", /return/);
  assert.match(deletionBlocker({ ...base, payoutsDue: 1 }) ?? "", /refund/);
});

test("staff and admins cannot delete themselves", () => {
  assert.match(deletionBlocker({ ...base, role: "ADMIN" }) ?? "", /removed by an admin/);
  assert.match(deletionBlocker({ ...base, role: "STAFF" }) ?? "", /removed by an admin/);
});
