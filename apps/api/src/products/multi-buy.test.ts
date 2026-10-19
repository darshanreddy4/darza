import assert from "node:assert/strict";
import test from "node:test";
import { multiBuyOf, priceLine } from "./multi-buy";

const own = { productType: "OWN" as const, multiBuyQty: 2, multiBuyPercent: 3 };

test("only our own products with both numbers set carry a multi-buy offer", () => {
  assert.deepEqual(multiBuyOf(own), { qty: 2, percent: 3 });
  assert.equal(multiBuyOf({ ...own, productType: "AFFILIATE" }), null);
  assert.equal(multiBuyOf({ ...own, multiBuyQty: null }), null);
  assert.equal(multiBuyOf({ ...own, multiBuyPercent: null }), null);
});

test("the saving applies from the required quantity and is built into the unit price", () => {
  const offer = { qty: 2, percent: 3 };
  assert.deepEqual(priceLine(56600, 1, offer), { unitPaise: 56600, savedPaise: 0, buyMoreFor: offer });
  assert.deepEqual(priceLine(56600, 2, offer), { unitPaise: 54902, savedPaise: 3396, buyMoreFor: null });
  assert.deepEqual(priceLine(56600, 5, offer), { unitPaise: 54902, savedPaise: 8490, buyMoreFor: null });
});

test("no offer means no change", () => {
  assert.deepEqual(priceLine(1000, 7, null), { unitPaise: 1000, savedPaise: 0, buyMoreFor: null });
});

test("unit prices round to a whole paisa and never go negative", () => {
  assert.equal(priceLine(999, 3, { qty: 3, percent: 3 }).unitPaise, 969);
  assert.equal(priceLine(1, 2, { qty: 2, percent: 50 }).unitPaise, 1);
  assert.equal(priceLine(0, 2, { qty: 2, percent: 50 }).unitPaise, 0);
});
