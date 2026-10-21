import assert from "node:assert/strict";
import test from "node:test";
import { codFor, codRulesOf } from "./cod";

const rules = { enabled: true, feePaise: 4000, maxOrderPaise: 500000 };

test("pay on delivery adds its fee when it is allowed", () => {
  assert.deepEqual(codFor(rules, 100000), { allowed: true, feePaise: 4000, reason: null });
  assert.deepEqual(codFor({ ...rules, feePaise: 0 }, 100000), { allowed: true, feePaise: 0, reason: null });
});

test("an order over the limit cannot use it, and the limit itself is allowed", () => {
  assert.equal(codFor(rules, 500000).allowed, true);
  const over = codFor(rules, 500001);
  assert.deepEqual([over.allowed, over.feePaise], [false, 0]);
  assert.match(over.reason!, /up to ₹5,000\. Please pay online/);
  assert.equal(codFor({ ...rules, maxOrderPaise: null }, 99_000_000).allowed, true);
});

test("switching it off refuses every order", () => {
  const off = codFor({ ...rules, enabled: false }, 100);
  assert.deepEqual([off.allowed, off.feePaise], [false, 0]);
  assert.match(off.reason!, /isn't available/);
});

test("a product that must be paid for online keeps cash out of the whole basket", () => {
  const v = codFor(rules, 1000, ["Sofa"]);
  assert.deepEqual([v.allowed, v.feePaise], [false, 0]);
  assert.equal(v.reason, "Sofa can only be paid for online.");
  assert.match(codFor(rules, 1000, ["Sofa", "Bed", "Desk"]).reason!, /Sofa, Bed and 1 more can only be paid for online/);
  assert.equal(codFor(rules, 1000, []).allowed, true);
});

test("a product sold with part payment cannot be bought on cash alone", () => {
  const v = codFor(rules, 1000, [], ["Sofa"]);
  assert.equal(v.allowed, false);
  assert.match(v.reason!, /Sofa needs part of the payment online first/);
  // Online only wins when both apply.
  assert.match(codFor(rules, 1000, ["Bed"], ["Sofa"]).reason!, /Bed can only be paid for online/);
});

test("rules are read from the store settings", () => {
  assert.deepEqual(codRulesOf({ codEnabled: false, codFeePaise: 2500, codMaxOrderPaise: null }), { enabled: false, feePaise: 2500, maxOrderPaise: null });
});
