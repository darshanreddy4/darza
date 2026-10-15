import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCategoryParent } from "./category-rules";

const main = { id: "m1", parentId: null };

test("top-level categories are always valid", () => {
  assert.equal(validateCategoryParent({ parentId: null }), null);
  assert.equal(validateCategoryParent({ parentId: undefined, childCount: 3 }), null);
});

test("a subcategory under a main category is valid", () => {
  assert.equal(validateCategoryParent({ parentId: "m1", parent: main }), null);
});

test("rejects self parent, missing parent, deeper nesting, and parents becoming children", () => {
  assert.ok(validateCategoryParent({ id: "a", parentId: "a", parent: main }));
  assert.ok(validateCategoryParent({ parentId: "zz", parent: null }));
  assert.ok(validateCategoryParent({ parentId: "s1", parent: { id: "s1", parentId: "m1" } }));
  assert.ok(validateCategoryParent({ id: "m1", parentId: "m2", parent: { id: "m2", parentId: null }, childCount: 2 }));
});
