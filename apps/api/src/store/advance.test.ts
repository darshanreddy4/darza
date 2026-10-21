import assert from "node:assert/strict";
import test from "node:test";
import { advanceFor, advanceNames, listNames, onlineOnlyNames } from "./advance";

const line = (name: string, advancePercent: number | null, onlineOnly = false) => ({ name, advancePercent, onlineOnly });

test("part payment takes the share asked for now and leaves the rest for delivery", () => {
  const o = advanceFor(true, [line("Sofa", 30)], 100000);
  assert.deepEqual(o, { available: true, reason: null, percent: 30, payNowPaise: 30000, balancePaise: 70000 });
});

test("a basket pays the highest share any product asks for", () => {
  const o = advanceFor(true, [line("Sofa", 30), line("Table", 40)], 200000);
  assert.deepEqual([o.percent, o.payNowPaise, o.balancePaise], [40, 80000, 120000]);
});

test("the share is rounded up to a whole paisa and is never less than one or more than the total", () => {
  assert.equal(advanceFor(true, [line("A", 33)], 1001).payNowPaise, 331);
  assert.equal(advanceFor(true, [line("A", 10)], 5).payNowPaise, 1);
  const tiny = advanceFor(true, [line("A", 90)], 1);
  assert.deepEqual([tiny.payNowPaise, tiny.balancePaise], [1, 0]);
});

test("every product in the basket has to offer it", () => {
  const mixed = advanceFor(true, [line("Sofa", 30), line("Mug", null)], 100000);
  assert.equal(mixed.available, false);
  assert.match(mixed.reason!, /isn't available for Mug/);
  assert.equal(advanceFor(true, [line("Sofa", 30, true)], 100000).available, false);
  assert.deepEqual([advanceFor(true, [line("Sofa", 30, true)], 100000).payNowPaise, advanceFor(true, [line("Sofa", 30, true)], 100000).balancePaise], [0, 0]);
});

test("it needs the store switch on and something to buy", () => {
  assert.match(advanceFor(false, [line("Sofa", 30)], 100000).reason!, /isn't offered/);
  assert.equal(advanceFor(true, [], 0).available, false);
  assert.equal(advanceFor(true, [line("Sofa", 30)], 0).available, false);
});

test("product names read naturally in a message", () => {
  assert.deepEqual(advanceNames(true, [line("A", 30), line("B", null), line("C", 30, true)]), ["A"]);
  assert.deepEqual(advanceNames(false, [line("A", 30)]), []);
  assert.equal(listNames(["A"]), "A");
  assert.equal(listNames(["A", "B"]), "A and B");
  assert.equal(listNames(["A", "B", "C", "D"]), "A, B and 2 more");
  assert.deepEqual(onlineOnlyNames([line("A", null, true), line("B", null), line("C", null, true)]), ["A", "C"]);
});
