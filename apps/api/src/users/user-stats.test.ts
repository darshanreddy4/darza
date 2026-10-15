import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, toCsv } from "./csv";
import { formatAddress, pickContact, summariseOrders, type StatsOrder } from "./user-stats";

const item = (productId: string, quantity: number, pricePaise: number) => ({ productId, name: `Product ${productId}`, slug: `p-${productId}`, quantity, pricePaise });
const order = (status: StatsOrder["status"], totalPaise: number, items: StatsOrder["items"], refundedPaise = 0): StatsOrder => ({ id: `${status}-${totalPaise}`, status, totalPaise, refundedPaise, items });

test("csv quotes commas, quotes and newlines", () => {
  assert.equal(csvCell('He said "hi", then left\nnow'), '"He said ""hi"", then left\nnow"');
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(5), "5");
});

test("csv neutralises spreadsheet formulas", () => {
  assert.equal(csvCell("=HYPERLINK(\"x\")"), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell("+91 98765"), "'+91 98765");
  assert.equal(csvCell(-5), "-5");
});

test("toCsv joins rows with a header", () => {
  assert.equal(toCsv(["a", "b"], [[1, "x,y"]]), 'a,b\r\n1,"x,y"\r\n');
});

test("summary counts only real purchases and separates returns", () => {
  const s = summariseOrders([
    order("DELIVERED", 30000, [item("a", 2, 10000), item("b", 1, 5000)]),
    order("PAID", 12000, [item("a", 1, 10000)]),
    order("PENDING_PAYMENT", 9900, [item("c", 1, 9900)]),
    order("CANCELLED", 5000, [item("b", 1, 5000)]),
    order("REFUNDED", 20000, [item("a", 2, 10000)], 20000),
  ]);
  assert.equal(s.orders, 2);
  assert.equal(s.items, 4);
  assert.equal(s.spentPaise, 42000);
  assert.equal(s.returnedOrders, 1);
  assert.equal(s.returnedItems, 2);
  assert.equal(s.refundedPaise, 20000);
  assert.equal(s.cancelledOrders, 1);
  const a = s.products.find((p) => p.productId === "a")!;
  assert.deepEqual([a.quantity, a.spentPaise, a.returnedQuantity], [3, 30000, 2]);
  assert.equal(s.products.some((p) => p.productId === "c"), false);
  assert.equal(s.products[0].productId, "a");
});

test("a partial refund on a delivered order counts as a return", () => {
  const s = summariseOrders([order("DELIVERED", 10000, [item("a", 1, 10000)], 4000)]);
  assert.equal(s.orders, 1);
  assert.equal(s.returnedOrders, 1);
  assert.equal(s.refundedPaise, 4000);
});

test("address is joined without blanks", () => {
  assert.equal(formatAddress({ line1: "12 Test St", line2: "", city: "Pune", state: "Maharashtra", pincode: "411001" }), "12 Test St, Pune, Maharashtra, 411001");
  assert.equal(formatAddress(null), "");
});

test("contact prefers the default saved address, then the latest order", () => {
  const base = { line1: "x", city: "c", state: "s", pincode: "1" };
  const older = { ...base, phone: "111", isDefault: true, createdAt: new Date("2026-01-01") };
  const newer = { ...base, phone: "222", isDefault: false, createdAt: new Date("2026-02-01") };
  assert.equal(pickContact([newer, older], null).phone, "111");
  assert.equal(pickContact([newer], null).phone, "222");
  assert.deepEqual(pickContact([], { phone: "333", line1: "Ship St", city: "Goa" }), { phone: "333", address: "Ship St, Goa" });
  assert.deepEqual(pickContact([], null), { phone: "", address: "" });
});
