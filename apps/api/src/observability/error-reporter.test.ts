import test from "node:test";
import assert from "node:assert/strict";
import { shouldReport } from "./error-reporter";

test("the same error is reported once per window, and the number of different ones is capped", () => {
  const store = new Map<string, number>();
  assert.equal(shouldReport("a", 0, store), true);
  assert.equal(shouldReport("a", 1000, store), false);
  assert.equal(shouldReport("a", 11 * 60 * 1000, store), true);
  const flood = new Map<string, number>();
  for (let i = 0; i < 10; i++) assert.equal(shouldReport(`e${i}`, 0, flood), true);
  assert.equal(shouldReport("another", 0, flood), false);
});
