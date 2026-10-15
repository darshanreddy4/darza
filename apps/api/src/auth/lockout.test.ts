import test from "node:test";
import assert from "node:assert/strict";
import { afterFailedLogin, lockMinutesLeft } from "./lockout";

const now = new Date("2026-10-20T10:00:00Z");

test("the account locks on the fifth wrong password and the count starts over", () => {
  assert.deepEqual(afterFailedLogin(4, now), { failedLogins: 4, lockedUntil: null });
  const locked = afterFailedLogin(5, now);
  assert.equal(locked.failedLogins, 0);
  assert.equal(locked.lockedUntil?.toISOString(), "2026-10-20T10:15:00.000Z");
});

test("minutes left round up and reach zero once the lock has passed", () => {
  assert.equal(lockMinutesLeft(null, now), 0);
  assert.equal(lockMinutesLeft(new Date("2026-10-20T10:00:30Z"), now), 1);
  assert.equal(lockMinutesLeft(new Date("2026-10-20T10:15:00Z"), now), 15);
  assert.equal(lockMinutesLeft(new Date("2026-10-20T09:59:00Z"), now), 0);
});
