import assert from "node:assert/strict";
import test from "node:test";
import { activeSale, sellingPrice, validateSale } from "./sale";

const now = new Date("2026-10-18T10:00:00Z");
const own = { productType: "OWN" as const, pricePaise: 69900, salePricePaise: 27900, saleEndsAt: new Date("2026-10-18T12:21:46Z") };

test("a sale runs until its end time and then the normal price returns by itself", () => {
  assert.deepEqual(activeSale(own, now), { pricePaise: 27900, endsAt: own.saleEndsAt });
  assert.equal(sellingPrice(own, now), 27900);
  const after = new Date("2026-10-18T12:21:46Z");
  assert.equal(activeSale(own, after), null);
  assert.equal(sellingPrice(own, after), 69900);
});

test("no sale without both numbers, for partner products, or when it is not a real discount", () => {
  assert.equal(activeSale({ ...own, salePricePaise: null }, now), null);
  assert.equal(activeSale({ ...own, saleEndsAt: null }, now), null);
  assert.equal(activeSale({ ...own, productType: "AFFILIATE" }, now), null);
  assert.equal(activeSale({ ...own, salePricePaise: 69900 }, now), null);
  assert.equal(activeSale({ ...own, salePricePaise: 80000 }, now), null);
  assert.equal(sellingPrice({ ...own, salePricePaise: null }, now), 69900);
});

test("the admin must give a price under the normal price together with an end time", () => {
  assert.deepEqual(validateSale({ pricePaise: 1000 }), []);
  assert.deepEqual(validateSale({ pricePaise: 1000, salePricePaise: 800, saleEndsAt: now }), []);
  assert.match(validateSale({ pricePaise: 1000, salePricePaise: 800 })[0], /both a sale price and an end time/);
  assert.match(validateSale({ pricePaise: 1000, saleEndsAt: now })[0], /both a sale price and an end time/);
  assert.match(validateSale({ pricePaise: 1000, salePricePaise: 1000, saleEndsAt: now })[0], /lower than the selling price/);
});
