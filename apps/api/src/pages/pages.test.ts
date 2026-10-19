import assert from "node:assert/strict";
import test from "node:test";
import { MAX_PAGE_BODY, isBuiltin, sanitizePage, slugProblem, slugify } from "./pages";

test("titles become tidy addresses", () => {
  assert.equal(slugify("Size Guide & Fit!"), "size-guide-fit");
  assert.equal(slugify("  --Returns  FAQ--  "), "returns-faq");
  assert.equal(slugify("Café Menu"), "cafe-menu");
  assert.equal(slugify("!!!"), "");
});

test("an address must be simple and not already used", () => {
  assert.equal(slugProblem("size-guide"), null);
  assert.match(slugProblem("") ?? "", /address/);
  assert.match(slugProblem("Size Guide") ?? "", /lowercase/);
  assert.match(slugProblem("a--b") ?? "", /lowercase/);
  assert.match(slugProblem("terms") ?? "", /already used/);
  assert.match(slugProblem("admin") ?? "", /already used/);
  assert.match(slugProblem("x".repeat(61)) ?? "", /lowercase/);
});

test("the five built-in pages are known", () => {
  for (const s of ["terms", "privacy", "shipping-policy", "refund-policy", "affiliate-disclosure"]) assert.ok(isBuiltin(s));
  assert.equal(isBuiltin("about"), false);
});

test("a custom page needs a title and text", () => {
  const r = sanitizePage({ title: "", body: "" }, true);
  assert.ok("errors" in r);
  const ok = sanitizePage({ title: "  Size   guide ", body: "Line one\r\nLine two\u0000", enabled: false }, true);
  assert.ok("page" in ok);
  if ("page" in ok) assert.deepEqual(ok.page, { title: "Size guide", body: "Line one\nLine two", enabled: false });
});

test("a built-in page may keep the standard text (empty body) or be hidden", () => {
  const r = sanitizePage({ enabled: false }, false);
  assert.ok("page" in r);
  if ("page" in r) assert.deepEqual(r.page, { title: "", body: "", enabled: false });
  const on = sanitizePage({}, false);
  if ("page" in on) assert.equal(on.page.enabled, true);
});

test("a page that is too long is refused", () => {
  const r = sanitizePage({ title: "Long", body: "x".repeat(MAX_PAGE_BODY + 1) }, true);
  assert.ok("errors" in r);
});
