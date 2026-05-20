"use client";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays, Locate } from "lucide-react";
import { isoLocalDate, previousWeekStart, nextWeekStart, startOfOperationalWeek } from "@/lib/week-config";
import type { SiblingSchedule } from "../types";

/**
 * Week navigator: previous / next / today + dropdown picker.
 *
 * Navigation is URL-driven (`?week=YYYY-MM-DD`) so deep links work and the
 * RSC fetch in `page.tsx` rehydrates the board. The picker lists every
 * known schedule so the user can jump straight to historical or future
 * planning weeks without scrubbing through arrows.
 */
export function WeekNavigator({
  weekStart,
  weekEnd,
  siblings,
}: {
  weekStart: string;
  weekEnd: string;
  siblings: SiblingSchedule[];
}) {
  const router = useRouter();
  const current = new Date(weekStart);

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

  function onPick(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (!id) return;
    const sched = siblings.find((s) => s.id === id);
    if (sched) go(isoLocalDate(new Date(sched.weekStart)));
  }

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtYear = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric" });

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
        <label className="text-xs text-ink-muted">Jump to</label>
        <select
          className="input !py-1 !text-xs !w-auto"
          onChange={onPick}
          value=""
        >
          <option value="">Select a week…</option>
          {siblings.map((s) => (
            <option key={s.id} value={s.id}>
              {fmt(s.weekStart)} – {fmt(s.weekEnd)} · {s.status}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
