import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PERMISSIONS, LEGACY_STAFF_PERMISSIONS, PERMISSION_GROUPS, PERMISSION_REQUIRES, ROLE_TEMPLATES,
  canDecideReturn, canSetOrderStatus, normalisePermissions, permissionsFor, withoutCost,
} from "./permissions";
import { keepCosts } from "../products/cost-guard";

describe("permission catalogue", () => {
  it("has unique keys, each with a label and a description", () => {
    assert.equal(new Set(ALL_PERMISSIONS).size, ALL_PERMISSIONS.length);
    for (const p of PERMISSION_GROUPS.flatMap((g) => g.permissions)) {
      assert.ok(p.label.length > 3);
      assert.ok(p.description.length > 10);
    }
  });

  it("only lists real permissions in the requirements, the legacy set and every template", () => {
    for (const [key, bases] of Object.entries(PERMISSION_REQUIRES)) {
      assert.ok(ALL_PERMISSIONS.includes(key));
      bases.forEach((b) => assert.ok(ALL_PERMISSIONS.includes(b)));
    }
    LEGACY_STAFF_PERMISSIONS.forEach((p) => assert.ok(ALL_PERMISSIONS.includes(p)));
    for (const t of ROLE_TEMPLATES) {
      assert.ok(t.permissions.length > 0);
      t.permissions.forEach((p) => assert.ok(ALL_PERMISSIONS.includes(p)));
      // A template is already complete: choosing it needs nothing added.
      assert.deepEqual(normalisePermissions(t.permissions).permissions.sort(), [...t.permissions].sort());
    }
    assert.equal(new Set(ROLE_TEMPLATES.map((t) => t.name)).size, ROLE_TEMPLATES.length);
  });
});

describe("permissionsFor", () => {
  it("gives admins everything", () => {
    assert.deepEqual(permissionsFor({ role: "ADMIN" }), ALL_PERMISSIONS);
  });
  it("gives customers nothing", () => {
    assert.deepEqual(permissionsFor({ role: "CUSTOMER", staffRole: { permissions: ["orders.view"] } }), []);
  });
  it("gives staff the permissions of their team role", () => {
    assert.deepEqual(permissionsFor({ role: "STAFF", staffRole: { permissions: ["orders.view", "nonsense"] } }), ["orders.view"]);
  });
  it("keeps the original staff access for staff without a team role", () => {
    assert.deepEqual(permissionsFor({ role: "STAFF", staffRole: null }), LEGACY_STAFF_PERMISSIONS);
    assert.ok(!LEGACY_STAFF_PERMISSIONS.includes("costs.view"));
    assert.ok(!LEGACY_STAFF_PERMISSIONS.includes("orders.cancel"));
    assert.ok(!LEGACY_STAFF_PERMISSIONS.includes("returns.refund"));
  });
});

describe("normalisePermissions", () => {
  it("adds what a permission builds on, drops repeats and reports unknown keys", () => {
    const r = normalisePermissions(["returns.refund", "returns.refund", "orders.process", "made.up"]);
    assert.deepEqual(r.permissions, ["orders.view", "orders.process", "returns.view", "returns.refund"]);
    assert.deepEqual(r.unknown, ["made.up"]);
  });
});

describe("order and return decisions", () => {
  it("needs the cancel permission to cancel or refund an order", () => {
    assert.equal(canSetOrderStatus(["orders.process"], "SHIPPED"), true);
    assert.equal(canSetOrderStatus(["orders.process"], "CANCELLED"), false);
    assert.equal(canSetOrderStatus(["orders.process"], "REFUNDED"), false);
    assert.equal(canSetOrderStatus(["orders.cancel"], "CANCELLED"), true);
    assert.equal(canSetOrderStatus(["orders.cancel"], "SHIPPED"), false);
    assert.equal(canSetOrderStatus(undefined, "SHIPPED"), false);
  });
  it("separates deciding a return from refunding it", () => {
    assert.equal(canDecideReturn(["returns.decide"], "approve"), true);
    assert.equal(canDecideReturn(["returns.decide"], "reject"), true);
    assert.equal(canDecideReturn(["returns.decide"], "refund"), false);
    assert.equal(canDecideReturn(["returns.refund"], "paid"), true);
    assert.equal(canDecideReturn(["returns.refund"], "approve"), false);
  });
});

describe("withoutCost", () => {
  const row = { name: "Tee", costPaise: 100, options: [{ label: "L", costPaise: 90 }] };
  it("leaves costs for those who may see them", () => {
    assert.equal(withoutCost(["costs.view"], row), row);
  });
  it("strips the product and option costs for everyone else", () => {
    const out = withoutCost(["products.view"], row);
    assert.deepEqual(out, { name: "Tee", options: [{ label: "L" }] });
    assert.equal(row.costPaise, 100);
  });
});

describe("keepCosts", () => {
  it("keeps the saved costs whatever the form sent", () => {
    const dto = { costPaise: 1, options: [{ id: "a", costPaise: 5 }, { costPaise: 7 }] };
    const out = keepCosts(dto, { costPaise: 100, options: [{ id: "a", costPaise: 60 }] });
    assert.equal(out.costPaise, 100);
    assert.deepEqual(out.options, [{ id: "a", costPaise: 60 }, { costPaise: undefined }]);
  });
  it("has no cost for a new product", () => {
    assert.equal(keepCosts({ costPaise: 9 }, null).costPaise, undefined);
  });
});
