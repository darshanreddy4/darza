import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProductRules } from "./product-rules";

test("valid OWN product", () => {
  assert.deepEqual(validateProductRules({ productType: "OWN", pricePaise: 100, sku: "A", stock: 3 }), []);
});

test("OWN product needs sku and stock, no affiliate url", () => {
  const errs = validateProductRules({ productType: "OWN", pricePaise: 100, affiliateUrl: "https://x.com" });
  assert.equal(errs.length, 3);
});

test("valid AFFILIATE product", () => {
  assert.deepEqual(
    validateProductRules({ productType: "AFFILIATE", pricePaise: 100, platform: "Amazon", affiliateUrl: "https://amazon.in/x" }),
    [],
  );
});

test("AFFILIATE product needs url and platform, no stock", () => {
  const errs = validateProductRules({ productType: "AFFILIATE", pricePaise: 100, stock: 1 });
  assert.equal(errs.length, 3);
});

test("mrp below price is rejected", () => {
  const errs = validateProductRules({ productType: "OWN", pricePaise: 200, mrpPaise: 100, sku: "A", stock: 1 });
  assert.equal(errs.length, 1);
});
