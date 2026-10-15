import test from "node:test";
import assert from "node:assert/strict";
import { backInStockMail } from "./stock-mail";

const data = { brand: "Acme", name: "Asha <b>", product: "Power Bank", pricePaise: 149900, url: "https://shop.example/products/power-bank" };

test("the back-in-stock email names the product, price and link", () => {
  const m = backInStockMail(data);
  assert.equal(m.subject, "Power Bank is back in stock");
  assert.match(m.text, /Power Bank is back in stock at ₹1,499/);
  assert.match(m.text, /products\/power-bank/);
});

test("the customer's name is escaped in the HTML", () => {
  assert.ok(backInStockMail(data).html.includes("Asha &lt;b&gt;"));
});
