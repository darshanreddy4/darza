import test from "node:test";
import assert from "node:assert/strict";
import { canDecideReturn, canSetOrderStatus, withoutCost } from "./permissions";

test("staff can move an order along but not cancel or refund it", () => {
  for (const s of ["PLACED", "PAID", "SHIPPED", "DELIVERED"] as const) assert.equal(canSetOrderStatus("STAFF", s), true);
  assert.equal(canSetOrderStatus("STAFF", "CANCELLED"), false);
  assert.equal(canSetOrderStatus("STAFF", "REFUNDED"), false);
  assert.equal(canSetOrderStatus("ADMIN", "REFUNDED"), true);
  assert.equal(canSetOrderStatus("CUSTOMER", "CANCELLED"), false);
});

test("staff can approve or decline a return but not refund it", () => {
  assert.equal(canDecideReturn("STAFF", "approve"), true);
  assert.equal(canDecideReturn("STAFF", "reject"), true);
  assert.equal(canDecideReturn("STAFF", "refund"), false);
  assert.equal(canDecideReturn("STAFF", "paid"), false);
  assert.equal(canDecideReturn("ADMIN", "paid"), true);
  assert.equal(canDecideReturn("ADMIN", "refund"), true);
});

test("cost is hidden from everyone but admins", () => {
  const row = { name: "Kettle", costPaise: 9000, pricePaise: 19900 };
  assert.deepEqual(withoutCost("STAFF", row), { name: "Kettle", pricePaise: 19900 });
  assert.equal(withoutCost("ADMIN", row).costPaise, 9000);
  // The cost of each size is hidden as well.
  const sized = { name: "Rice", options: [{ label: "1 kg", costPaise: 5000, pricePaise: 8000 }] };
  assert.deepEqual(withoutCost("STAFF", sized), { name: "Rice", options: [{ label: "1 kg", pricePaise: 8000 }] });
  assert.equal(withoutCost("ADMIN", sized).options[0].costPaise, 5000);
});
