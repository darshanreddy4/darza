import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LOGO_DESIGN, sanitizeLogoDesign } from "./logo-design";
import { sanitizeProfile } from "./profile";

const ok = (v: unknown) => {
  const r = sanitizeLogoDesign(v);
  assert.ok("design" in r, JSON.stringify(r));
  return r.design;
};
const bad = (v: unknown) => {
  const r = sanitizeLogoDesign(v);
  assert.ok("errors" in r);
  return r.errors.join(" | ");
};

test("nothing sent gives the default picture logo", () => {
  assert.deepEqual(ok(undefined), DEFAULT_LOGO_DESIGN);
  assert.deepEqual(ok({}), DEFAULT_LOGO_DESIGN);
});

test("a styled text logo with a colour for every letter is kept", () => {
  const d = ok({ mode: "TEXT", text: "  Google  ", font: "pacifico", weight: 400, colorMode: "PER_LETTER", letterColors: ["#4285F4", "#EA4335", "#FBBC05", "#4285f4", "#34A853", "#EA4335"], effect: "3D", depth: 3, uppercase: true, italic: true, spacing: "wide", size: "large" });
  assert.equal(d.text, "Google");
  assert.equal(d.mode, "TEXT");
  assert.equal(d.letterColors.length, 6);
  assert.equal(d.letterColors[0], "#4285f4");
  assert.equal(d.depth, 3);
  assert.equal(d.italic, true);
});

test("text is cleaned and limited", () => {
  assert.equal(ok({ text: "A\u0000B\n\nC" }).text, "A B C");
  assert.equal(ok({ text: "x".repeat(80) }).text.length, 30);
});

test("unknown fonts, effects, modes and weights are refused", () => {
  assert.match(bad({ font: "comic-sans" }), /font/);
  assert.match(bad({ effect: "RAINBOW" }), /effect/);
  assert.match(bad({ mode: "VIDEO" }), /style/);
  assert.match(bad({ weight: 123 }), /weight/);
  assert.match(bad({ depth: 9 }), /depth/);
});

test("colours must be six-digit hex values", () => {
  assert.match(bad({ color: "red" }), /colour/);
  assert.match(bad({ color: "url(javascript:alert(1))" }), /colour/);
  assert.match(bad({ letterColors: ["#12b886", "blue"] }), /letter colour/);
  assert.match(bad({ gradient: ["#12b886", "nope"] }), /gradient/);
});

test("the design travels with the brand profile and bad designs block saving", () => {
  const good = sanitizeProfile({ logoDesign: { mode: "TEXT", text: "DMG", font: "bebas" } });
  assert.ok("profile" in good);
  if ("profile" in good) assert.equal(good.profile.logoDesign.font, "bebas");
  const blocked = sanitizeProfile({ logoDesign: { font: "nope" } });
  assert.ok("errors" in blocked);
});
