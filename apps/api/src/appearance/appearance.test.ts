import test from "node:test";
import assert from "node:assert/strict";
import { effectiveRate, hexColour, inrPerUnit, normaliseChrome, parseChrome, parseProviderRates, parseStoredRates, rateFromInrPerUnit, selectionProblem, THEME_KEYS } from "./appearance";

test("a manual rate wins over the automatic one, and unknown or bad values are ignored", () => {
  const rates = parseStoredRates({ auto: { USD: 0.012, EUR: 0.011, XXX: 3, GBP: -1 }, manual: { USD: 0.0125, EUR: "x" } });
  assert.equal(effectiveRate(rates, "USD"), 0.0125);
  assert.equal(effectiveRate(rates, "EUR"), 0.011);
  assert.equal(effectiveRate(rates, "GBP"), null);
  assert.equal(effectiveRate(rates, "XXX"), null);
  assert.deepEqual(parseStoredRates(null), { auto: {}, manual: {} });
});

test("an exchange-rate answer is read for supported currencies only", () => {
  assert.deepEqual(parseProviderRates({ result: "success", rates: { INR: 1, USD: 0.012, EUR: 0.011, ZZZ: 5, GBP: 0 } }), { USD: 0.012, EUR: 0.011 });
  assert.equal(parseProviderRates({ rates: {} }), null);
  assert.equal(parseProviderRates("nope"), null);
});

test("rupees per unit and units per rupee convert both ways", () => {
  assert.equal(rateFromInrPerUnit(80), 0.0125);
  assert.equal(inrPerUnit(0.0125), 80);
  assert.equal(inrPerUnit(0.012), 83.3333);
});

test("the offered currencies and the default are checked", () => {
  assert.equal(selectionProblem(["USD", "EUR"], "INR"), null);
  assert.equal(selectionProblem(["USD", "EUR"], "EUR"), null);
  assert.match(selectionProblem(["USD"], "EUR") ?? "", /default currency/);
  assert.match(selectionProblem(["USD", "USD"], "INR") ?? "", /twice/);
  assert.match(selectionProblem(["XXX"], "INR") ?? "", /not supported/);
  assert.match(selectionProblem(Array.from({ length: 13 }, (_, i) => String(i)), "INR") ?? "", /at most/);
});

test("the original look stays available as DEFAULT", () => {
  assert.ok(THEME_KEYS.includes("DEFAULT"));
  assert.equal(new Set(THEME_KEYS).size, 8);
});

test("only hex colours are accepted, and short ones are expanded", () => {
  assert.equal(hexColour("#1E3A8A"), "#1e3a8a");
  assert.equal(hexColour("#fa0"), "#ffaa00");
  for (const bad of ["red", "#12", "#12345", "#gggggg", "rgb(1,2,3)", "#fff;}", "url(x)", "", null, 5]) assert.equal(hexColour(bad), null, String(bad));
});

test("header, search bar, category bar and footer styles are cleaned and checked", () => {
  const ok = normaliseChrome({
    header: { bg: "#0B1220", fg: "#FFF", image: "/uploads/abc123.webp", overlay: 40, junk: "x" },
    search: { bg: "#ffffff", button: "#12b886", buttonFg: "#000" },
    nav: { bg: "#fde68a" },
    footer: { bg: "#111111", image: "https://cdn.example.com/a.jpg" },
    other: { bg: "#000000" },
  });
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.value, {
    header: { bg: "#0b1220", fg: "#ffffff", image: "/uploads/abc123.webp", overlay: 40 },
    search: { bg: "#ffffff", button: "#12b886", buttonFg: "#000000" },
    nav: { bg: "#fde68a" },
    footer: { bg: "#111111", image: "https://cdn.example.com/a.jpg" },
  });
  // Empty means "standard look".
  assert.deepEqual(normaliseChrome({}).value, {});
  assert.deepEqual(normaliseChrome({ header: { bg: "", image: "" } }).value, {});
});

test("anything that is not a colour or a safe picture address is refused", () => {
  const bad = normaliseChrome({ header: { bg: "red;}", image: "javascript:alert(1)", overlay: 120 }, footer: { image: 'https://x.com/a.png"); background: url(("' }, search: "nope" });
  assert.equal(bad.problems.length, 5);
  assert.deepEqual(bad.value, {});
  for (const image of ["http://insecure.com/a.png", "/uploads/../etc/passwd", "/other/x.png", "https://x.com/a b.png"]) assert.equal(normaliseChrome({ header: { image } }).problems.length, 1, image);
});

test("a damaged saved style is ignored instead of breaking the shop", () => {
  assert.deepEqual(parseChrome(null), {});
  assert.deepEqual(parseChrome("x"), {});
  assert.deepEqual(parseChrome({ header: { bg: "nope", fg: "#000000" }, footer: 5 }), { header: { fg: "#000000" } });
});
