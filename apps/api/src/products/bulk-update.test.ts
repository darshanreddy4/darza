import test from "node:test";
import assert from "node:assert/strict";
import { planBulkPatch, validateBulkChanges, type BulkRow } from "./bulk-update";

const own: BulkRow = { productType: "OWN", pricePaise: 100000, mrpPaise: 120000 };
const partner: BulkRow = { productType: "AFFILIATE", pricePaise: 50000, mrpPaise: null };

test("needs at least one change", () => {
  assert.deepEqual(validateBulkChanges({}), ["Choose at least one change"]);
  assert.deepEqual(validateBulkChanges({ dealLabel: "Sale" }), []);
});

test("a product with size options keeps its prices and stock, but other changes still apply", () => {
  const sized: BulkRow = { ...own, hasOptions: true };
  assert.ok(planBulkPatch(sized, { priceChangePercent: -10 }).skipReason?.includes("size options"));
  assert.ok(planBulkPatch(sized, { stock: 5 }).skipReason);
  assert.deepEqual(planBulkPatch(sized, { featured: true }).patch, { featured: true });
});

test("rejects contradictory options", () => {
  assert.ok(validateBulkChanges({ pricePaise: 100, priceChangePercent: -10 }).length);
  assert.ok(validateBulkChanges({ mrpPaise: 100, clearMrp: true }).length);
  assert.ok(validateBulkChanges({ mrpFromOldPrice: true }).length);
  assert.ok(validateBulkChanges({ pricePaise: 5000, mrpPaise: 4000 }).length);
  assert.ok(validateBulkChanges({ deliveryDays: 2, clearDelivery: true }).length);
});

test("sets and clears the deal label", () => {
  assert.deepEqual(planBulkPatch(own, { dealLabel: "  Mega Festival Deal " }).patch, { dealLabel: "Mega Festival Deal" });
  assert.deepEqual(planBulkPatch(own, { dealLabel: "" }).patch, { dealLabel: null });
});

test("sets one price on every product", () => {
  assert.deepEqual(planBulkPatch(own, { pricePaise: 99900 }).patch, { pricePaise: 99900 });
  assert.deepEqual(planBulkPatch(partner, { pricePaise: 99900 }).patch, { pricePaise: 99900 });
});

test("percentage change rounds to whole paise", () => {
  assert.equal(planBulkPatch(own, { priceChangePercent: -20 }).patch.pricePaise, 80000);
  assert.equal(planBulkPatch({ ...own, pricePaise: 12345 }, { priceChangePercent: -15 }).patch.pricePaise, 10493);
  assert.equal(planBulkPatch(own, { priceChangePercent: 10 }).patch.pricePaise, 110000);
});

test("festival discount keeps the old price as MRP", () => {
  const plan = planBulkPatch({ productType: "OWN", pricePaise: 100000, mrpPaise: null }, { priceChangePercent: -20, mrpFromOldPrice: true });
  assert.deepEqual(plan.patch, { pricePaise: 80000, mrpPaise: 100000 });
  // A higher existing MRP is kept rather than lowered.
  assert.deepEqual(planBulkPatch(own, { priceChangePercent: -20, mrpFromOldPrice: true }).patch, { pricePaise: 80000, mrpPaise: 120000 });
});

test("an inherited MRP that ends up below the new price is dropped", () => {
  const plan = planBulkPatch(own, { pricePaise: 150000 });
  assert.deepEqual(plan.patch, { pricePaise: 150000, mrpPaise: null });
  assert.equal(plan.mrpDropped, true);
});

test("an explicit MRP below a product's price skips that product", () => {
  const plan = planBulkPatch(own, { mrpPaise: 90000 });
  assert.deepEqual(plan.patch, {});
  assert.match(plan.skipReason ?? "", /MRP/);
  assert.deepEqual(planBulkPatch(own, { mrpPaise: 150000 }).patch, { mrpPaise: 150000 });
});

test("removing the MRP", () => {
  assert.deepEqual(planBulkPatch(own, { clearMrp: true }).patch, { mrpPaise: null });
});

test("stock, delivery and cart settings apply to DMG products only", () => {
  const changes = { stock: 25, showAddToCart: true, deliveryDays: 3, freeDelivery: true };
  assert.deepEqual(planBulkPatch(own, changes).patch, { stock: 25, showAddToCart: true, deliveryDays: 3, freeDelivery: true, chargeDelivery: false, deliveryFeePaise: null });
  const p = planBulkPatch(partner, changes);
  assert.deepEqual(p.patch, {});
  assert.match(p.skipReason ?? "", /Partner/);
});

test("mixed changes still update partner products where they apply", () => {
  assert.deepEqual(planBulkPatch(partner, { dealLabel: "Sale", stock: 5 }).patch, { dealLabel: "Sale" });
});

test("removing delivery also turns off free delivery", () => {
  assert.deepEqual(planBulkPatch(own, { clearDelivery: true }).patch, { deliveryDays: null, freeDelivery: false });
});

test("publish, unpublish and feature", () => {
  assert.deepEqual(planBulkPatch(own, { status: "DRAFT", featured: true }).patch, { status: "DRAFT", featured: true });
});
