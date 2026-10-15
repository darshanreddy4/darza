import test from "node:test";
import assert from "node:assert/strict";
import { salesReportRows, summariseOrders, type ReportOrder } from "./sales-report";

const base: ReportOrder = {
  id: "cmabcdef12345678", createdAt: new Date("2026-10-14T18:45:00Z"), invoiceNumber: "DZ/2026-27/00001", status: "DELIVERED", paymentMethod: "COD", couponCode: null,
  discountPaise: 0, shippingPaise: 0, totalPaise: 11800, refundedPaise: 0, gstApplied: true, shippingAddr: { state: "Karnataka" },
  user: { name: "Asha", email: "asha@example.com", phone: null }, items: [{ quantity: 1, pricePaise: 11800, gstRatePercent: 18 }],
};
const settings = { businessState: "Karnataka", shippingGstPercent: 18 };

test("a sale inside the seller's state splits GST into CGST and SGST", () => {
  const [row] = salesReportRows([base], settings);
  assert.equal(row[0], "#12345678");
  assert.equal(row[1], "2026-10-15 00:15"); // India time is 5h30 ahead of UTC
  assert.deepEqual(row.slice(14, 18), ["100.00", "9.00", "9.00", "0.00"]);
});

test("a sale to another state is charged IGST", () => {
  const [row] = salesReportRows([{ ...base, shippingAddr: { state: "Kerala" } }], settings);
  assert.deepEqual(row.slice(14, 18), ["100.00", "0.00", "0.00", "18.00"]);
});

test("orders without GST report no tax", () => {
  const [row] = salesReportRows([{ ...base, gstApplied: false }], settings);
  assert.deepEqual(row.slice(14, 18), ["118.00", "0.00", "0.00", "0.00"]);
});

test("cancelled and refunded orders are listed but not added to the sales totals", () => {
  const rows = salesReportRows([base, { ...base, id: "x2", status: "CANCELLED" }, { ...base, id: "x3", status: "REFUNDED", refundedPaise: 11800 }], settings);
  assert.equal(rows[1][6], "No");
  assert.deepEqual(rows[1].slice(14, 18), ["", "", "", ""]);
  const totals = rows[3];
  assert.equal(totals[0], "Total (orders that count as sales)");
  assert.equal(totals[8], 1);
  assert.equal(totals[13], "118.00");
  assert.equal(totals[18], "118.00"); // refunds are totalled across every order
});

test("discount and delivery flow into the figures", () => {
  const order = { ...base, discountPaise: 1800, shippingPaise: 5900, totalPaise: 15900 };
  const [row] = salesReportRows([order], settings);
  assert.equal(row[10], "18.00");
  assert.equal(row[12], "59.00");
  assert.equal(row[13], "159.00");
  // goods 100.00 and delivery 59.00 both carry 18% GST inside the price
  assert.deepEqual(row.slice(14, 18), ["134.75", "12.12", "12.13", "0.00"]);
});

test("the summary counts sales, units, money and cancellations", () => {
  const s = summariseOrders([base, { ...base, id: "x2", status: "CANCELLED" }, { ...base, id: "x3", status: "REFUNDED", refundedPaise: 11800 }, { ...base, id: "x4", discountPaise: 1800, shippingPaise: 4900, totalPaise: 14900 }]);
  assert.deepEqual(s, { orders: 2, units: 2, itemsPaise: 23600, discountPaise: 1800, deliveryPaise: 4900, paidPaise: 26700, refundedPaise: 11800, cancelledOrders: 1 });
});
