import test from "node:test";
import assert from "node:assert/strict";
import { questionMail } from "./question-mail";

const data = { brand: "Acme", name: "Asha <b>", product: "Power Bank", question: "Does it charge two phones?", answer: "Yes, <i>both</i> ports at once.", url: "https://shop.example/products/pb#questions" };

test("the answer email quotes the question and links to the product", () => {
  const m = questionMail(data);
  assert.equal(m.subject, "Your question about Power Bank was answered");
  assert.match(m.text, /Your question: Does it charge two phones\?/);
  assert.match(m.text, /products\/pb#questions/);
});

test("customer and admin text is escaped in the HTML", () => {
  const html = questionMail(data).html;
  assert.ok(!html.includes("<b>") && !html.includes("<i>"));
  assert.ok(html.includes("Asha &lt;b&gt;"));
});
