import test from "node:test";
import assert from "node:assert/strict";
import { effectiveRate, inrPerUnit, parseProviderRates, parseStoredRates, rateFromInrPerUnit, selectionProblem, THEME_KEYS } from "./appearance";

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
