import test from "node:test";
import assert from "node:assert/strict";
import { salesReportMail } from "./report-mail";

const data = { brand: "Acme <Mart>", label: "September 2026", url: "https://shop.example/admin/analytics", filename: "sales-report-2026-09-01_2026-09-30.csv",
  summary: { orders: 12, units: 20, itemsPaise: 1_000_000, discountPaise: 50_000, deliveryPaise: 29_400, paidPaise: 979_400, refundedPaise: 59_900, cancelledOrders: 2 } };

test("the email carries the headline figures and names the attachment", () => {
  const m = salesReportMail(data);
  assert.equal(m.subject, "Acme <Mart> sales report: September 2026");
  assert.match(m.text, /Orders: 12/);
  assert.match(m.text, /Goods sold \(after discounts\): ₹9,500/);
  assert.match(m.text, /Total collected: ₹9,794/);
  assert.match(m.text, /Refunded: ₹599/);
  assert.match(m.text, /sales-report-2026-09-01_2026-09-30\.csv/);
});

test("the brand name is escaped in the HTML", () => {
  assert.ok(salesReportMail(data).html.includes("Acme &lt;Mart&gt;"));
});
