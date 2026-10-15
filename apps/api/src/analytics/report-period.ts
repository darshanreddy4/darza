export type ReportSchedule = "OFF" | "WEEKLY" | "MONTHLY";

const IST = 19_800_000;
const DAY = 86_400_000;
// Reports go out in the morning rather than at midnight.
const SEND_AFTER_MS = 6 * 3_600_000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface ReportPeriod { start: Date; end: Date; label: string; sendAt: Date }

const day = (d: Date) => { const i = new Date(d.getTime() + IST); return `${i.getUTCDate()} ${MONTHS[i.getUTCMonth()].slice(0, 3)} ${i.getUTCFullYear()}`; };

// The last complete week (Monday to Sunday) or month in India time, and when its report is due.
export function lastPeriod(schedule: Exclude<ReportSchedule, "OFF">, now: Date): ReportPeriod {
  const ist = new Date(now.getTime() + IST);
  const y = ist.getUTCFullYear(), m = ist.getUTCMonth();
  if (schedule === "WEEKLY") {
    const sinceMonday = (ist.getUTCDay() + 6) % 7;
    const end = new Date(Date.UTC(y, m, ist.getUTCDate() - sinceMonday) - IST);
    const start = new Date(end.getTime() - 7 * DAY);
    return { start, end, label: `Week of ${day(start)} to ${day(new Date(end.getTime() - 1))}`, sendAt: new Date(end.getTime() + SEND_AFTER_MS) };
  }
  const end = new Date(Date.UTC(y, m, 1) - IST);
  const start = new Date(Date.UTC(y, m - 1, 1) - IST);
  const prev = new Date(start.getTime() + IST);
  return { start, end, label: `${MONTHS[prev.getUTCMonth()]} ${prev.getUTCFullYear()}`, sendAt: new Date(end.getTime() + SEND_AFTER_MS) };
}

// Due once the new week or month has started (plus the morning delay) and nothing has been sent since.
export function reportDue(schedule: ReportSchedule, now: Date, lastSentAt: Date | null): ReportPeriod | null {
  if (schedule === "OFF") return null;
  const period = lastPeriod(schedule, now);
  if (now < period.sendAt) return null;
  if (lastSentAt && lastSentAt >= period.sendAt) return null;
  return period;
}
