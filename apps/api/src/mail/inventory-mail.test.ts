import test from "node:test";
import assert from "node:assert/strict";
import { lowStockMail } from "./inventory-mail";

const base = { brand: "Acme", threshold: 5, url: "https://shop.example/admin/attention" };

test("the subject says how many products are affected and how many are sold out", () => {
  const m = lowStockMail({ ...base, items: [{ name: "Kettle", sku: "K-1", stock: 0 }, { name: "Mug <b>", sku: null, stock: 3 }] });
  assert.equal(m.subject, "2 products need restocking (1 sold out)");
  assert.match(m.text, /Kettle \(K-1\): SOLD OUT/);
  assert.match(m.text, /Mug <b>: 3 left/);
  assert.ok(m.html.includes("Mug &lt;b&gt;"));
});

test("a single low product with stock left reads naturally", () => {
  assert.equal(lowStockMail({ ...base, items: [{ name: "Mug", sku: null, stock: 2 }] }).subject, "1 product is running low on stock");
});
