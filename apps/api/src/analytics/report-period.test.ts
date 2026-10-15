import test from "node:test";
import assert from "node:assert/strict";
import { lastPeriod, reportDue } from "./report-period";

// 2026-10-14 is a Wednesday.
const wed = new Date("2026-10-14T08:00:00+05:30");

test("the last week is Monday to Sunday in India time", () => {
  const p = lastPeriod("WEEKLY", wed);
  assert.equal(p.start.toISOString(), "2026-10-04T18:30:00.000Z"); // Mon 5 Oct 00:00 IST
  assert.equal(p.end.toISOString(), "2026-10-11T18:30:00.000Z"); // Mon 12 Oct 00:00 IST
  assert.equal(p.label, "Week of 5 Oct 2026 to 11 Oct 2026");
});

test("the last month is the whole previous calendar month", () => {
  const p = lastPeriod("MONTHLY", wed);
  assert.equal(p.label, "September 2026");
  assert.equal(p.start.toISOString(), "2026-08-31T18:30:00.000Z");
  assert.equal(p.end.toISOString(), "2026-09-30T18:30:00.000Z");
  assert.equal(lastPeriod("MONTHLY", new Date("2026-01-03T10:00:00+05:30")).label, "December 2025");
});

test("a weekly report is due on Monday morning, once", () => {
  const monEarly = new Date("2026-10-12T02:00:00+05:30");
  const monMorning = new Date("2026-10-12T07:00:00+05:30");
  assert.equal(reportDue("WEEKLY", monEarly, null), null);
  assert.ok(reportDue("WEEKLY", monMorning, null));
  assert.equal(reportDue("WEEKLY", wed, new Date("2026-10-12T07:05:00+05:30")), null);
  assert.ok(reportDue("WEEKLY", wed, new Date("2026-10-05T07:05:00+05:30")));
});

test("a monthly report is due on the 1st, and switching it on mid-month waits for the next one", () => {
  assert.ok(reportDue("MONTHLY", new Date("2026-10-01T07:00:00+05:30"), new Date("2026-09-01T07:05:00+05:30")));
  assert.equal(reportDue("MONTHLY", new Date("2026-10-20T07:00:00+05:30"), new Date("2026-10-14T00:00:00+05:30")), null);
  assert.equal(reportDue("OFF", wed, null), null);
});
