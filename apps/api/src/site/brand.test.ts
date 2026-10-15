import { test } from "node:test";
import assert from "node:assert/strict";
import { applyBrand } from "./brand";

test("{brand} is replaced everywhere in nested text", () => {
  const out = applyBrand({ title: "Sold by {brand}", items: [{ text: "{brand} and partners, {brand}" }, 5, null], n: 3 }, "Acme");
  assert.deepEqual(out, { title: "Sold by Acme", items: [{ text: "Acme and partners, Acme" }, 5, null], n: 3 });
});

test("text without the placeholder, dates and other values are left alone", () => {
  const d = new Date("2026-01-01");
  assert.equal(applyBrand("Plain text", "Acme"), "Plain text");
  assert.equal(applyBrand(d, "Acme"), d);
  assert.equal(applyBrand(undefined, "Acme"), undefined);
});

test("brand names with special characters are inserted as they are", () => {
  assert.equal(applyBrand("Hi {brand}", "A$&B $1"), "Hi A$&B $1");
});
