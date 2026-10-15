import test from "node:test";
import assert from "node:assert/strict";
import { describeAction, sanitiseBody } from "./audit-describe";

test("reads, uploads and dry runs are not logged", () => {
  assert.equal(describeAction({ method: "GET", routePath: "/admin/orders" }), null);
  assert.equal(describeAction({ method: "POST", routePath: "/admin/uploads" }), null);
  assert.equal(describeAction({ method: "POST", routePath: "/admin/products/import", query: { dryRun: "true" } }), null);
  assert.equal(describeAction({ method: "POST", routePath: "/auth/login" }), null);
});

test("known actions read as plain sentences", () => {
  const status = describeAction({ method: "PATCH", routePath: "/admin/orders/:id/status", params: { id: "cmabcdef12345678" }, body: { status: "SHIPPED" } })!;
  assert.equal(status.summary, "Set order #12345678 to shipped");
  assert.equal(status.entity, "order");
  assert.equal(status.entityId, "cmabcdef12345678");

  assert.equal(describeAction({ method: "PATCH", routePath: "/admin/returns/:id", params: { id: "r1" }, body: { action: "reject", note: "x" } })!.summary, "Declined a return request");
  assert.equal(describeAction({ method: "PUT", routePath: "/admin/products/:id", params: { id: "p1" }, body: { name: "Kettle" } })!.summary, "Updated product Kettle");
  assert.equal(describeAction({ method: "POST", routePath: "/admin/products/bulk", body: { ids: ["a", "b", "c"], changes: {} } })!.summary, "Edited 3 products at once");
});

test("unknown admin routes fall back to a generic line", () => {
  const e = describeAction({ method: "DELETE", routePath: "/admin/banners/:id", params: { id: "b1" } })!;
  assert.equal(e.action, "banners.delete");
  assert.equal(e.summary, "Deleted banners");
});

test("secrets and bulky fields are kept out of the details", () => {
  const e = describeAction({ method: "PUT", routePath: "/admin/products/:id", params: { id: "p1" }, body: { name: "Kettle", description: "x".repeat(5000), password: "hunter2", images: [{ url: "a" }, { url: "b" }], pricePaise: 100 } })!;
  assert.deepEqual(e.details, { name: "Kettle", description: "[omitted]", password: "[hidden]", images: "[2 items]", pricePaise: 100 });
});

test("a CSV body is recorded by size only", () => {
  const e = describeAction({ method: "POST", routePath: "/admin/products/import", body: "slug\nx" })!;
  assert.deepEqual(e.details, { bytes: 6 });
});

test("long text and long lists are shortened", () => {
  assert.equal((sanitiseBody("y".repeat(300)) as string).length, 201);
  assert.equal(sanitiseBody([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), "[11 items]");
});
