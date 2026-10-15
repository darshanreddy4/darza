import test from "node:test";
import assert from "node:assert/strict";
import { BUCKET_FORMAT, dateRange, netFigures, parseGranularity } from "./analytics-utils";

test("the end date is inclusive and days start at midnight India time", () => {
  const { start, end } = dateRange("2026-10-10", "2026-10-12");
  assert.equal(start.toISOString(), "2026-10-09T18:30:00.000Z");
  assert.equal(end.toISOString(), "2026-10-12T18:30:00.000Z");
});

test("bad or backwards ranges are rejected", () => {
  assert.throws(() => dateRange("2026-10-12", "2026-10-10"), /Invalid date range/);
  assert.throws(() => dateRange("12-10-2026", "2026-10-12"), /Invalid date range/);
});

test("hourly charts are limited to a month", () => {
  const short = dateRange("2026-10-01", "2026-10-07");
  assert.equal(parseGranularity("hour", short.start, short.end), "hour");
  const long = dateRange("2026-08-01", "2026-10-07");
  assert.throws(() => parseGranularity("hour", long.start, long.end), /at most 31 days/);
  assert.equal(parseGranularity("month", long.start, long.end), "month");
  assert.equal(parseGranularity(undefined, long.start, long.end), "day");
  assert.throws(() => parseGranularity("week", long.start, long.end), /hour, day or month/);
});

test("every bucket has a format", () => {
  assert.deepEqual(Object.keys(BUCKET_FORMAT), ["hour", "day", "month"]);
});

test("discounts reduce both revenue and profit", () => {
  assert.deepEqual(netFigures(100000, 40000, 5000), { revenuePaise: 95000, profitPaise: 35000 });
  assert.deepEqual(netFigures(0, 0, 0), { revenuePaise: 0, profitPaise: 0 });
});
