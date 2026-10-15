import test from "node:test";
import assert from "node:assert/strict";
import { cartReminderMail } from "./cart-mail";

const data = { brand: "Acme", name: "Asha <b>", items: [{ name: "Charger", quantity: 2, pricePaise: 59900 }, { name: "Cable", quantity: 1, pricePaise: 29900 }], cartUrl: "https://shop.example/cart", unsubscribeUrl: "https://shop.example/unsubscribe?token=abc" };

test("the reminder lists the items, the subtotal and both links", () => {
  const m = cartReminderMail(data);
  assert.equal(m.subject, "You left something in your Acme cart");
  assert.match(m.text, /Charger x 2   ₹1,198/);
  assert.match(m.text, /Subtotal: ₹1,497/);
  assert.match(m.text, /shop\.example\/cart/);
  assert.match(m.text, /unsubscribe\?token=abc/);
});

test("the customer's name is escaped in the HTML", () => {
  const html = cartReminderMail(data).html;
  assert.ok(!html.includes("<b>"));
  assert.ok(html.includes("Asha &lt;b&gt;"));
});
