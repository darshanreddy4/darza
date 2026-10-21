import { test } from "node:test";
import assert from "node:assert/strict";
import { diffSnapshots, itemKey, mainQuantity, planOut, snapKey, type Snapshot, type StockItem } from "./ledger-rules";

const item = (productId: string, optionId: string | null, stock: number): StockItem => ({ productId, optionId, productName: productId, optionLabel: optionId, stock });
const snap = (...items: StockItem[]): Snapshot => new Map(items.map((i) => [snapKey(i.productId, i.optionId), i]));

test("an item without options has a stable key", () => {
  assert.equal(itemKey(null), "-");
  assert.equal(itemKey("opt1"), "opt1");
});

test("units come out of the main warehouse first, then the biggest other shelf", () => {
  assert.deepEqual(planOut(10, [{ warehouseId: "b", quantity: 4 }], 3), [{ warehouseId: null, quantity: 3 }]);
  assert.deepEqual(planOut(2, [{ warehouseId: "b", quantity: 1 }, { warehouseId: "c", quantity: 5 }], 6), [{ warehouseId: null, quantity: 2 }, { warehouseId: "c", quantity: 4 }]);
  assert.deepEqual(planOut(0, [{ warehouseId: "b", quantity: 3 }, { warehouseId: "c", quantity: 3 }], 5), [{ warehouseId: "b", quantity: 3 }, { warehouseId: "c", quantity: 2 }]);
});

test("units the shelves cannot account for are charged to the main warehouse, so the parts always add up", () => {
  const parts = planOut(1, [{ warehouseId: "b", quantity: 1 }], 5);
  assert.equal(parts.reduce((n, p) => n + p.quantity, 0), 5);
  assert.deepEqual(parts, [{ warehouseId: null, quantity: 4 }, { warehouseId: "b", quantity: 1 }]);
  assert.deepEqual(planOut(-3, [], 2), [{ warehouseId: null, quantity: 2 }]);
});

test("a diff finds changed, new and removed items, and ignores the ones that did not change", () => {
  const before = snap(item("p1", null, 10), item("p2", "a", 5), item("p2", "b", 3), item("p3", null, 4));
  const after = snap(item("p1", null, 7), item("p2", "a", 5), item("p4", null, 6), item("p3", null, 4));
  const changes = diffSnapshots(before, after);
  const find = (p: string, o: string | null) => changes.find((c) => c.item.productId === p && c.item.optionId === o);
  assert.deepEqual([find("p1", null)!.delta, find("p1", null)!.balanceAfter, find("p1", null)!.removed], [-3, 7, false]);
  assert.equal(find("p4", null)!.delta, 6);
  assert.deepEqual([find("p2", "b")!.delta, find("p2", "b")!.removed], [-3, true]);
  assert.equal(find("p2", "a"), undefined);
  assert.equal(find("p3", null), undefined);
  assert.equal(changes.length, 3);
});

test("a removed item that had no stock leaves no movement", () => {
  assert.deepEqual(diffSnapshots(snap(item("p1", "a", 0)), snap()), []);
});

test("the main warehouse holds the total minus the others, never below zero", () => {
  assert.equal(mainQuantity(10, [3, 2]), 5);
  assert.equal(mainQuantity(2, [3]), 0);
  assert.equal(mainQuantity(7, []), 7);
});
