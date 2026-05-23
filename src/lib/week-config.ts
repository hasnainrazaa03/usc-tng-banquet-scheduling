/**
 * Week configuration — single source of truth for the operational week.
 *
 * USC Private Events & Conferences operates on a THURSDAY → WEDNESDAY week.
 * Every place that needs to compute a week boundary, iterate days in order,
 * or render day-of-week columns MUST go through this module so that we never
 * regress to a Sunday-based week.
 *
 * The week-start day is intentionally a constant for now; a future Phase will
 * surface it via the `AppSetting` table so it can be re-configured per tenant
 * without code changes.
 */

import type { DayOfWeek } from "@prisma/client";

/** JS Date.getDay() index (Sun=0..Sat=6). */
export type DowIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Native getDay() value for the first day of the operational week. */
export const WEEK_STARTS_ON: DowIndex = 4; // Thursday

/** DOW codes in NATIVE Sun..Sat order — matches Prisma `DayOfWeek` enum order. */
export const DOW_NATIVE = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export type DowCode = (typeof DOW_NATIVE)[number];

/**
 * DOW codes in OPERATIONAL order (Thursday-first).
 * Use this for column headers, roster grids, print layouts, etc.
 */
export const DOW_OPERATIONAL: readonly DowCode[] = (() => {
  const out: DowCode[] = [];
  for (let i = 0; i < 7; i++) out.push(DOW_NATIVE[(WEEK_STARTS_ON + i) % 7]);
  return out;
})();

/** Long-form labels for UI. */
export const DOW_LONG: Record<DowCode, string> = {
  SUN: "Sunday",
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
};

/** Returns the operational week start (Thursday 00:00 local) for any input date. */
export function startOfOperationalWeek(d: Date | string): Date {
  const x = typeof d === "string" ? new Date(d) : new Date(d);
  x.setHours(0, 0, 0, 0);
  const diff = (x.getDay() - WEEK_STARTS_ON + 7) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

/** Returns the operational week end (Wednesday 23:59:59.999 local) for any input date. */
export function endOfOperationalWeek(d: Date | string): Date {
  const start = startOfOperationalWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** Convenience: returns the 7 dates of the operational week containing `d`, Thursday-first. */
export function operationalWeekDates(d: Date | string): Date[] {
  const start = startOfOperationalWeek(d);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return x;
  });
}

/** Maps a JS Date to the DOW code string used everywhere in this codebase. */
export function dowCode(d: Date | string): DowCode {
  const x = typeof d === "string" ? new Date(d) : d;
  return DOW_NATIVE[x.getDay()];
}

/** Prisma `DayOfWeek` enum string for a given date. */
export function dayOfWeekEnum(d: Date | string): DayOfWeek {
  return dowCode(d) as DayOfWeek;
}

/** Returns the Date for the previous operational week containing `d`. */
export function previousWeekStart(d: Date | string): Date {
  const start = startOfOperationalWeek(d);
  start.setDate(start.getDate() - 7);
  return start;
}

/** Returns the Date for the next operational week containing `d`. */
export function nextWeekStart(d: Date | string): Date {
  const start = startOfOperationalWeek(d);
  start.setDate(start.getDate() + 7);
  return start;
}

/** Returns the operational column index (0..6) for `d` where 0 = Thursday. */
export function operationalDayIndex(d: Date | string): number {
  const x = typeof d === "string" ? new Date(d) : d;
  return (x.getDay() - WEEK_STARTS_ON + 7) % 7;
}

/** ISO YYYY-MM-DD string in LOCAL time (avoids UTC drift for week-boundary math). */
export function isoLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parse a date string as a LOCAL date.
 *
 * `new Date("2026-05-21")` is interpreted as UTC midnight, which in any
 * negative-offset timezone (e.g. PDT) reads back as the previous calendar
 * day in local time. That single off-by-one was the root cause of the
 * "Today goes to the wrong week" / "Next moves but not by one week" bugs
 * on the schedule board.
 *
 * This helper accepts either a bare `YYYY-MM-DD` (parsed in local TZ at
 * 00:00) or any full ISO string (delegated to the standard Date parser).
 * Always returns a Date safe to pass into `startOfOperationalWeek`.
 */
export function parseLocalDate(s: string | Date | undefined | null): Date {
  if (!s) return new Date();
  if (s instanceof Date) return s;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  }
  return new Date(s);
}
