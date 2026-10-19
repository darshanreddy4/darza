import assert from "node:assert/strict";
import test from "node:test";
import { productReturnDays, textSaysNoReturn } from "./return-policy";

test("the usual ways of writing 'no returns' are understood", () => {
  for (const t of ["No return", "no returns", "NO RETURN POLICY", "Non-returnable", "non returnable item", "No refund or exchange", "Not returnable", "Not eligible for returns"]) assert.ok(textSaysNoReturn(t), t);
  for (const t of ["7-day replacement for defects", "Easy returns within 10 days", "Returnable", "", null, undefined]) assert.ok(!textSaysNoReturn(t), String(t));
});

const own = { productType: "OWN" as const, returnDays: null, returnPolicy: null };

test("a product's own setting beats its text, which beats the store's window", () => {
  assert.equal(productReturnDays(own, 7), 7);
  assert.equal(productReturnDays({ ...own, returnPolicy: "No return" }, 7), 0);
  assert.equal(productReturnDays({ ...own, returnDays: 3, returnPolicy: "No return" }, 7), 3);
  assert.equal(productReturnDays({ ...own, returnDays: 0 }, 7), 0);
  assert.equal(productReturnDays({ ...own, returnDays: 15 }, 7), 15);
  assert.equal(productReturnDays(own, 0), 0);
});

test("partner products are never returned to us", () => {
  assert.equal(productReturnDays({ ...own, productType: "AFFILIATE", returnDays: 10 }, 7), 0);
});
