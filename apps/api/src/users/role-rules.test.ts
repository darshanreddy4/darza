import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRoleChange } from "./role-rules";

const base = { actorId: "a", targetId: "b", currentRole: "CUSTOMER", newRole: "ADMIN", adminCount: 1 } as const;

test("an admin can promote a customer", () => {
  assert.equal(validateRoleChange({ ...base }), null);
});

test("an admin can demote another admin while others remain", () => {
  assert.equal(validateRoleChange({ ...base, currentRole: "ADMIN", newRole: "CUSTOMER", adminCount: 2 }), null);
});

test("nobody can change their own role", () => {
  assert.match(validateRoleChange({ ...base, targetId: "a", currentRole: "ADMIN", newRole: "CUSTOMER", adminCount: 3 })!, /own role/);
});

test("the last admin cannot be demoted", () => {
  assert.match(validateRoleChange({ ...base, currentRole: "ADMIN", newRole: "CUSTOMER", adminCount: 1 })!, /at least one admin/);
});

test("setting the role someone already has is a harmless no-op", () => {
  assert.equal(validateRoleChange({ ...base, currentRole: "ADMIN", newRole: "ADMIN", adminCount: 1 }), null);
});
