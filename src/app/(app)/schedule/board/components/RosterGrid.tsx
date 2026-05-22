"use client";
import { useDroppable } from "@dnd-kit/core";
import { useMemo } from "react";
import { AssignmentChip } from "./Draggables";
import {
  DOW,
  ROLE_COLORS,
  STATUS_COLORS,
  fmtTime,
  dayKey,
  type Assignment,
  type Server,
  type Shift,
} from "../types";

/**
 * Roster grid view: rows = servers (sorted by seniority), columns = days
 * of the week. Each cell shows that server's shifts for that day, with
 * role coloring + status overrides. Sticky header row + sticky first
 * column behave like a spreadsheet.
 *
 * This view is purpose-built for "what does each server's week look like"
 * and matches the layout on the printable schedule.
 */
export function RosterGrid({
  schedule,
  shifts,
  servers,
  onRemove,
  onToggleLock,
  conflictIds,
  density,
}: {
  schedule: { weekStart: string };
  shifts: Shift[];
  servers: Server[];
  onRemove: (id: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  conflictIds: Set<string>;
  density: "comfortable" | "compact";
}) {
  // Index assignments by server × day.
  const cells = useMemo(() => {
    const m = new Map<string, Map<string, { shift: Shift; assignment: Assignment }[]>>();
    for (const s of servers) m.set(s.id, new Map(DOW.map((d) => [d, []])));
    for (const sh of shifts) {
      const day = dayKey(sh.date);
      for (const a of sh.assignments) {
        m.get(a.serverId)?.get(day)?.push({ shift: sh, assignment: a });
      }
    }
    return m;
  }, [shifts, servers]);

  // Build a list of "unstaffed openings per day" badges shown in the header.
  const openingsByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of DOW) map[d] = 0;
    for (const sh of shifts) {
      if (sh.statusCode !== "NONE") continue;
      const req = sh.requirements.reduce((s, r) => s + r.count, 0);
      map[dayKey(sh.date)] += Math.max(0, req - sh.assignments.length);
    }
    return map;
  }, [shifts]);

  const rowH = density === "compact" ? "min-h-[36px]" : "min-h-[56px]";
  const padCell = density === "compact" ? "p-1" : "p-1.5";

  return (
    <div className="rounded-2xl border border-ink/10 bg-white overflow-hidden shadow-sm">
      <div className="overflow-auto max-h-[calc(100vh-220px)]">
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 bg-cardinal text-white text-left px-3 py-2 w-[220px] min-w-[220px] border-r border-cardinal-800">
                <div className="font-display text-sm">Server</div>
                <div className="text-[10px] opacity-80 font-normal">Sorted by seniority</div>
              </th>
              {DOW.map((d, i) => {
                const date = new Date(schedule.weekStart);
                date.setDate(date.getDate() + i);
                return (
                  <th key={d} className="bg-cardinal text-white px-2 py-2 text-center border-l border-cardinal-800 min-w-[150px]">
                    <div className="font-display text-sm">{d}</div>
                    <div className="text-[10px] opacity-80 font-normal">
                      {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    {openingsByDay[d] > 0 && (
                      <div className="mt-0.5 inline-block rounded-full bg-gold text-cardinal-900 text-[9px] font-mono px-1.5 py-0.5">
                        {openingsByDay[d]} open
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {servers.map((s, idx) => (
              <tr key={s.id} className={`${rowH} ${idx % 2 === 0 ? "bg-white" : "bg-canvas-soft/40"}`}>
                {/* Sticky first column needs an explicit, opaque background
                    matching the row — `bg-inherit` doesn't reliably inherit
                    the alternating shade, so cells scroll-bleed through. */}
                <td className={`sticky left-0 z-10 ${idx % 2 === 0 ? "bg-white" : "bg-[#f5f0eb]"} border-r border-ink/10 px-3 py-1.5 align-top`}>
                  <div className="font-medium text-sm leading-tight">{s.lastName}, {s.firstName}</div>
                  <div className="text-[10px] text-ink-muted flex items-center gap-1.5">
                    <span className="font-mono">#{s.seniority?.seniorityRank ?? "—"}</span>
                    <span>·</span>
                    <span>{s.seniority?.yearsOfService.toFixed(1) ?? "0"}y</span>
                  </div>
                </td>
                {DOW.map((d) => {
                  const list = cells.get(s.id)?.get(d) ?? [];
                  return (
                    <RosterCell
                      key={d}
                      serverId={s.id}
                      day={d}
                      items={list}
                      onRemove={onRemove}
                      onToggleLock={onToggleLock}
                      conflictIds={conflictIds}
                      padCell={padCell}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RosterCell({
  items,
  onRemove,
  onToggleLock,
  conflictIds,
  padCell,
}: {
  serverId: string;
  day: string;
  items: { shift: Shift; assignment: Assignment }[];
  onRemove: (id: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  conflictIds: Set<string>;
  padCell: string;
}) {
  // Each shift the server is on becomes a draggable chip identifying that
  // assignment. To re-assign someone else to this day we use the in-card
  // role slots from the Day view; this cell is informational + chip-actionable.
  if (items.length === 0) {
    return <td className={`align-top border-l border-ink/10 ${padCell}`} />;
  }
  return (
    <td className={`align-top border-l border-ink/10 ${padCell} space-y-1`}>
      {items.map(({ shift, assignment }) => {
        const tone = ROLE_COLORS[assignment.roleCode ?? ""] ?? { bg: "bg-white", text: "text-ink", border: "border-ink/15" };
        const statusCls = shift.statusCode !== "NONE" ? STATUS_COLORS[shift.statusCode] : "";
        return (
          <div
            key={assignment.id}
            className={`rounded border px-1.5 py-1 leading-tight ${statusCls || `${tone.bg} ${tone.border}`}`}
            title={assignment.reason ?? ""}
          >
            {shift.statusCode !== "NONE" ? (
              <div className="text-center font-bold text-[10px]">{shift.statusCode}</div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[10px]">{fmtTime(shift.startsAt)}</span>
                  <span className={`text-[9px] font-semibold ${tone.text}`}>{assignment.roleCode}</span>
                </div>
                <div className="text-[10px] text-ink-muted truncate">
                  {[shift.locationCode, shift.roomCode].filter(Boolean).join("/") || shift.label}
                </div>
                {conflictIds.has(assignment.id) && (
                  <div className="text-[9px] text-red-700 font-semibold mt-0.5">⚠ conflict</div>
                )}
              </>
            )}
          </div>
        );
      })}
    </td>
  );
}
