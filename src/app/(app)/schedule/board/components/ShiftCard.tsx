"use client";
import { useDroppable } from "@dnd-kit/core";
import { UserCircle2 } from "lucide-react";
import { AssignmentChip } from "./Draggables";
import { ROLE_COLORS, STATUS_COLORS, fmtTime, type Assignment, type Shift } from "../types";

/**
 * A single role slot inside a shift (e.g. CAP 0/2). Renders the assigned
 * chips and a dashed drop zone if there are still openings.
 */
export function RoleSlot({
  shiftId,
  role,
  count,
  assigned,
  onRemove,
  onToggleLock,
  onCallout,
  conflictIds,
}: {
  shiftId: string;
  role: { code: string; name: string; color: string | null };
  count: number;
  assigned: Assignment[];
  onRemove: (id: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  onCallout?: (a: Assignment) => void;
  conflictIds: Set<string>;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `shift:${shiftId}:${role.code}` });
  // Called-out assignments don't count toward the filled total, freeing the
  // slot up for a replacement to be dragged in.
  const active = assigned.filter((a) => !a.calledOut);
  const open = count - active.length;
  const tone = ROLE_COLORS[role.code] ?? { bg: "bg-white", text: "text-ink", border: "border-ink/15" };

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-md border transition-all px-1.5 py-1
        ${isOver ? "border-cardinal bg-cardinal/10 ring-2 ring-cardinal/30" : ""}
        ${!isOver && open > 0 ? "border-dashed border-red-300 bg-red-50/40" : ""}
        ${!isOver && open === 0 ? `${tone.border} ${tone.bg}` : ""}
      `}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-1">
        <span className={`font-semibold ${tone.text}`}>{role.code}</span>
        <span className={`font-mono ${open > 0 ? "text-red-700" : "text-emerald-700"}`}>
          {active.length}/{count}
        </span>
      </div>
      <div className="space-y-1">
        {assigned.map((a) => (
          <AssignmentChip
            key={a.id}
            a={a}
            onRemove={onRemove}
            onToggleLock={onToggleLock}
            onCallout={onCallout}
            conflict={conflictIds.has(a.id)}
          />
        ))}
        {open > 0 && (
          <div className="text-center text-[10px] text-red-700/80 italic py-0.5">
            {open} open
          </div>
        )}
      </div>
    </div>
  );
}

/** A full shift card — used in the day-grid view. */
export function ShiftCard({
  shift,
  onRemove,
  onToggleLock,
  onCallout,
  conflictIds,
}: {
  shift: Shift;
  onRemove: (id: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  onCallout?: (a: Assignment) => void;
  conflictIds: Set<string>;
}) {
  if (shift.statusCode !== "NONE") {
    return (
      <div className={`rounded-lg border p-2 text-xs ${STATUS_COLORS[shift.statusCode] ?? "bg-canvas-soft border-ink/15"}`}>
        <div className="font-semibold uppercase tracking-wider text-[10px]">{shift.statusCode}</div>
        {shift.assignments.map((a) => (
          <div key={a.id} className="text-[11px]">
            {a.server.lastName}, {a.server.firstName}
          </div>
        ))}
      </div>
    );
  }

  const totalReq = shift.requirements.reduce((s, r) => s + r.count, 0);
  // Called-out assignments don't count toward the staffed total — they need
  // to be replaced. Display them separately under "out sick".
  const activeAssignments = shift.assignments.filter((a) => !a.calledOut);
  const calledOut = shift.assignments.filter((a) => a.calledOut);
  const totalAssigned = activeAssignments.length;
  const isUnderfilled = totalAssigned < totalReq;
  const isOverfilled = totalAssigned > totalReq;

  const guests = shift.event?.beo?.expectedGuests ?? shift.event?.guests ?? null;
  const managerName = shift.event?.beo?.manager?.name ?? null;

  return (
    <div className={`rounded-lg border bg-white overflow-hidden ${isUnderfilled ? "border-red-200" : isOverfilled ? "border-amber-300" : "border-ink/15"}`}>
      <div className="px-2 py-1.5 bg-canvas-soft/60 border-b border-ink/10">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-ink">{fmtTime(shift.startsAt)} – {fmtTime(shift.endsAt)}</span>
          <span className="text-[10px] text-ink-muted font-mono">
            {[shift.locationCode, shift.roomCode].filter(Boolean).join("/")}
          </span>
        </div>
        <div className="text-xs font-medium truncate mt-0.5">{shift.label ?? shift.event?.name ?? "Shift"}</div>
        <div className="flex items-center justify-between gap-2 text-[10px] mt-0.5">
          <span
            className={
              isUnderfilled
                ? "text-red-700 font-semibold"
                : isOverfilled
                  ? "text-amber-700 font-semibold"
                  : "text-emerald-700"
            }
            title={isOverfilled ? "Manually staffed above requirement" : undefined}
          >
            {totalAssigned}/{totalReq} staffed{isOverfilled ? " ↑" : ""}
          </span>
          {guests != null && (
            <span className="text-ink-muted font-mono">{guests} guests</span>
          )}
        </div>
        {managerName && (
          <div className="flex items-center gap-1 text-[10px] text-ink-muted mt-0.5">
            <UserCircle2 className="h-3 w-3" />
            <span className="truncate">Mgr: {managerName}</span>
          </div>
        )}
      </div>
      <div className="p-1.5 space-y-1">
        {shift.requirements.map((req) => {
          const filled = shift.assignments.filter((a) => a.roleCode === req.role.code);
          return (
            <RoleSlot
              key={req.id}
              shiftId={shift.id}
              role={req.role}
              count={req.count}
              assigned={filled}
              onRemove={onRemove}
              onToggleLock={onToggleLock}
              onCallout={onCallout}
              conflictIds={conflictIds}
            />
          );
        })}
        {calledOut.length > 0 && (
          <div className="text-[10px] text-red-700/80 italic px-1.5">
            {calledOut.length} out sick — needs replacement
          </div>
        )}
      </div>
    </div>
  );
}
