"use client";

/**
 * Schedule operations panel — collapsible toolbar that consolidates the
 * AI auto-scheduler and the Recent Schedules picker into the board
 * itself, so the standalone `/schedule/generate` route is no longer needed.
 *
 * Two sections, each independently collapsible:
 *   1. Run AI Schedule — week-anchored form. Calls POST /api/schedule/run
 *      with `weekStart` (operational-Thursday-normalised server-side) and
 *      a `clearFirst` flag. On success the page is refreshed so the board
 *      reflects the newly-generated shifts/assignments.
 *   2. Recent Schedules — list of the most recent stored `Schedule` rows
 *      with quick "Open" / "Print" links. Useful to jump to historical
 *      schedules without scrubbing the week navigator.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, History, Wand2 } from "lucide-react";
import {
  isoLocalDate,
  parseLocalDate,
  startOfOperationalWeek,
} from "@/lib/week-config";
import type { SiblingSchedule } from "../types";

export function ScheduleOpsPanel({
  currentScheduleId,
  currentWeekStart,
  siblings,
}: {
  currentScheduleId: string;
  currentWeekStart: string;
  siblings: SiblingSchedule[];
}) {
  const router = useRouter();
  const [openAi, setOpenAi] = useState(false);
  const [openRecent, setOpenRecent] = useState(false);

  // AI form state
  const [weekStart, setWeekStart] = useState(() =>
    isoLocalDate(startOfOperationalWeek(parseLocalDate(currentWeekStart))),
  );
  const [name, setName] = useState("Weekly schedule");
  const [clearFirst, setClearFirst] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | { scheduleId?: string; filled?: number; unfilled?: number; error?: string }
    | null
  >(null);

  async function runAi() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/schedule/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, name, clearFirst }),
      });
      const raw = await res.text();
      let parsed: any = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { error: `Server returned ${res.status}` };
        }
      }
      if (!res.ok) {
        setResult({ error: parsed?.error ?? `Request failed (${res.status})` });
        return;
      }
      setResult(parsed);
      if (parsed?.scheduleId) {
        // Navigate the board to the newly-generated schedule.
        router.push(`/schedule/board?id=${parsed.scheduleId}`);
        router.refresh();
      }
    } catch (err) {
      setResult({
        error: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setBusy(false);
    }
  }

  const anchoredThursday = isoLocalDate(
    startOfOperationalWeek(parseLocalDate(weekStart)),
  );
  const pickedDay = parseLocalDate(weekStart).toLocaleDateString("en-US", {
    weekday: "long",
  });

  const fmt = (d: string) =>
    parseLocalDate(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {/* === AI Generate === */}
      <div className="card !p-0 overflow-hidden">
        <button
          onClick={() => setOpenAi((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-canvas-soft transition"
          aria-expanded={openAi}
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <Wand2 className="h-4 w-4 text-cardinal" />
            Run AI Schedule
          </span>
          {openAi ? (
            <ChevronDown className="h-4 w-4 text-ink-muted" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-muted" />
          )}
        </button>
        {openAi && (
          <div className="px-3 pb-3 pt-1 border-t border-ink/5 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-ink-muted">Name</span>
                <input
                  className="input w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs text-ink-muted">Week start</span>
                <input
                  type="date"
                  className="input w-full"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                />
              </label>
            </div>
            <p className="text-[11px] text-ink-muted">
              Picked {pickedDay}. Will anchor to Thursday{" "}
              <code>{anchoredThursday}</code>.
            </p>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={clearFirst}
                onChange={(e) => setClearFirst(e.target.checked)}
              />
              Clear unlocked assignments first
            </label>
            <div className="flex justify-end">
              <button
                onClick={runAi}
                disabled={busy}
                className="btn-primary !py-1.5 text-sm"
              >
                {busy ? "Running…" : "Run Auto-Schedule"}
              </button>
            </div>
            {result?.error && (
              <div className="text-xs text-cardinal bg-cardinal-50 border border-cardinal-200 rounded px-2 py-1.5">
                {result.error}
              </div>
            )}
            {result && !result.error && (
              <div className="text-xs bg-canvas-soft rounded px-2 py-1.5">
                <strong>{result.filled}</strong> filled,{" "}
                <strong>{result.unfilled}</strong> unfilled
              </div>
            )}
          </div>
        )}
      </div>

      {/* === Recent Schedules === */}
      <div className="card !p-0 overflow-hidden">
        <button
          onClick={() => setOpenRecent((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-canvas-soft transition"
          aria-expanded={openRecent}
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4 text-cardinal" />
            Recent Schedules
            <span className="text-[11px] text-ink-muted">({siblings.length})</span>
          </span>
          {openRecent ? (
            <ChevronDown className="h-4 w-4 text-ink-muted" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-muted" />
          )}
        </button>
        {openRecent && (
          <div className="px-3 pb-3 pt-1 border-t border-ink/5 max-h-64 overflow-y-auto">
            {siblings.length === 0 ? (
              <p className="text-xs text-ink-muted py-2">No stored schedules.</p>
            ) : (
              <ul className="divide-y divide-ink/5">
                {siblings.map((s) => {
                  const isCurrent = s.id === currentScheduleId;
                  return (
                    <li
                      key={s.id}
                      className="py-2 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">
                          {s.name}
                        </div>
                        <div className="text-[11px] text-ink-muted">
                          {fmt(s.weekStart)} → {fmt(s.weekEnd)} ·{" "}
                          <span className="uppercase">{s.status}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isCurrent ? (
                          <span className="pill bg-cardinal/10 text-cardinal text-[10px]">
                            Current
                          </span>
                        ) : (
                          <Link
                            href={`/schedule/board?id=${s.id}`}
                            className="btn-outline !px-2 !py-1 text-[11px]"
                          >
                            Open
                          </Link>
                        )}
                        <Link
                          href={`/schedule/print?id=${s.id}`}
                          className="btn-ghost !px-2 !py-1 text-[11px]"
                        >
                          Print
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
