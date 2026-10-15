import test from "node:test";
import assert from "node:assert/strict";
import { isSafeKey } from "./storage.service";

test("only generated file names and cache names are valid storage keys", () => {
  assert.equal(isSafeKey("0123456789abcdef0123456789abcdef.jpg"), true);
  assert.equal(isSafeKey(".cache/0123456789abcdef0123456789abcdef-w640.webp"), true);
  assert.equal(isSafeKey("../secret"), false);
  assert.equal(isSafeKey(".cache/../x.jpg"), false);
  assert.equal(isSafeKey("/etc/passwd"), false);
  assert.equal(isSafeKey("a/b.jpg"), false);
  assert.equal(isSafeKey(""), false);
});
