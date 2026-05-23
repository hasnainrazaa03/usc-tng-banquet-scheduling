"use client";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays, Locate } from "lucide-react";
import {
  isoLocalDate,
  previousWeekStart,
  nextWeekStart,
  startOfOperationalWeek,
  parseLocalDate,
} from "@/lib/week-config";
import type { SiblingSchedule } from "../types";

/**
 * Week navigator: previous / next / today + native calendar picker.
 *
 * Navigation is URL-driven (`?week=YYYY-MM-DD`) so deep links work and the
 * RSC fetch in `page.tsx` rehydrates the board with the correct week's
 * BEOs / shifts / assignments / managers from the database.
 *
 * Phase 9 fix:
 *   - `parseLocalDate(weekStart)` instead of `new Date(weekStart)` — the
 *     previous code parsed bare YYYY-MM-DD as UTC and drifted a day in
 *     negative timezones, so Today/Prev/Next computed boundaries from the
 *     *previous* operational week.
 *   - The legacy "Jump to" dropdown listing historical schedules is
 *     replaced by a real `<input type="date">` calendar picker. Picking
 *     any day anchors to that day's operational Thursday — the user can
 *     reach any week of the year, not just ones with a pre-existing
 *     `Schedule` row.
 */
export function WeekNavigator({
  weekStart,
  weekEnd,
}: {
  weekStart: string;
  weekEnd: string;
  // `siblings` is intentionally ignored now (replaced by the calendar
  // picker); keeping it in the type would force every call site to change.
  siblings?: SiblingSchedule[];
}) {
  const router = useRouter();
  const current = parseLocalDate(weekStart);

  function go(dateIso: string) {
    router.push(`/schedule/board?week=${dateIso}`);
  }

  function jump(direction: "prev" | "next" | "today") {
    let target: Date;
    if (direction === "prev") target = previousWeekStart(current);
    else if (direction === "next") target = nextWeekStart(current);
    else target = startOfOperationalWeek(new Date());
    go(isoLocalDate(target));
  }

  function onPickDate(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value; // YYYY-MM-DD (already local from <input type="date">)
    if (!v) return;
    const anchor = startOfOperationalWeek(parseLocalDate(v));
    go(isoLocalDate(anchor));
  }

  const fmt = (d: string) =>
    parseLocalDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtYear = (d: string) =>
    parseLocalDate(d).toLocaleDateString("en-US", { year: "numeric" });

  // Value bound to the calendar picker — the operational-week start as
  // a YYYY-MM-DD local string. Updating it via the date input fires onPickDate.
  const pickerValue = isoLocalDate(startOfOperationalWeek(current));

  return (
    <div className="card !p-2 flex flex-wrap items-center gap-2 justify-between">
      <div className="inline-flex items-center gap-1">
        <button
          onClick={() => jump("prev")}
          className="btn-ghost !px-2 !py-1.5"
          aria-label="Previous week"
          title="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => jump("today")}
          className="btn-outline !px-2.5 !py-1.5 text-xs"
          title="Jump to current operational week"
        >
          <Locate className="h-3.5 w-3.5" />
          Today
        </button>
        <button
          onClick={() => jump("next")}
          className="btn-ghost !px-2 !py-1.5"
          aria-label="Next week"
          title="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <CalendarDays className="h-4 w-4 text-cardinal" />
        <span className="font-medium">
          Thu {fmt(weekStart)} — Wed {fmt(weekEnd)}
        </span>
        <span className="text-ink-muted">· {fmtYear(weekStart)}</span>
      </div>

      <div className="inline-flex items-center gap-2">
        <label htmlFor="week-picker" className="text-xs text-ink-muted">
          Pick a date
        </label>
        <input
          id="week-picker"
          type="date"
          value={pickerValue}
          onChange={onPickDate}
          className="input !py-1 !text-xs !w-auto"
          title="Pick any date — the board jumps to that day's operational week (Thu → Wed)"
        />
      </div>
    </div>
  );
}
