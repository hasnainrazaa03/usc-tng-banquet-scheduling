"use client";
import { ChevronDown, ChevronRight, Plus, UserCircle2 } from "lucide-react";
import { AssignmentChip, ManagerChip } from "./Draggables";
import {
  ROLE_COLORS,
  STATUS_COLORS,
  fmtTime,
  type Assignment,
  type Shift,
} from "../types";

/**
 * BEO manager slot — Phase 14: no longer a drop zone. Renders the manager
 * chip when set, otherwise a "+ Assign manager" button that opens the
 * manager picker modal targeted at this BEO.
 */
export function ManagerSlot({
  beoId,
  manager,
  onOpenManagerPicker,
  onClearManager,
}: {
  beoId: string;
  manager: { id: string; name: string } | null;
  onOpenManagerPicker: (beoId: string) => void;
  onClearManager?: (beoId: string) => void;
}) {
  return (
    <div
      className={`
        mt-1 rounded-md border px-1.5 py-0.5
        ${manager ? "border-cardinal-200/60 bg-cardinal-50/40" : "border-dashed border-ink/20 bg-canvas-soft/40"}
      `}
    >
      {manager ? (
        <ManagerChip
          beoId={beoId}
          manager={manager}
          onSwap={onOpenManagerPicker}
          onClear={onClearManager ?? (() => {})}
        />
      ) : (
        <button
          type="button"
          onClick={() => onOpenManagerPicker(beoId)}
          className="flex items-center gap-1 text-[10px] text-cardinal hover:text-cardinal-700 font-medium w-full"
        >
          <UserCircle2 className="h-3 w-3" />
          <Plus className="h-3 w-3" />
          <span>Assign manager</span>
        </button>
      )}
    </div>
  );
}

/**
 * Role slot — Phase 14: no longer a drop zone. Renders any assignment chips
 * plus, when there are open seats, a "+" button per open seat that opens
 * the server picker scoped to this (shiftId, roleCode).
 */
export function RoleSlot({
  shiftId,
  role,
  count,
  assigned,
  onRemove,
  onToggleLock,
  onCallout,
  onOpenServerPicker,
  conflictIds,
}: {
  shiftId: string;
  role: { code: string; name: string; color: string | null };
  count: number;
  assigned: Assignment[];
  onRemove: (id: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  onCallout?: (a: Assignment) => void;
  onOpenServerPicker: (shiftId: string, roleCode: string) => void;
  conflictIds: Set<string>;
}) {
  const active = assigned.filter((a) => !a.calledOut);
  const open = count - active.length;
  const tone =
    ROLE_COLORS[role.code] ??
    { bg: "bg-white", text: "text-ink", border: "border-ink/15" };

  return (
    <div
      className={`
        rounded-md border px-1.5 py-1
        ${open > 0 ? "border-dashed border-red-300 bg-red-50/40" : `${tone.border} ${tone.bg}`}
      `}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-1">
        <span className={`font-semibold ${tone.text}`}>{role.code}</span>
        <span
          className={`font-mono ${open > 0 ? "text-red-700" : "text-emerald-700"}`}
        >
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
          <button
            type="button"
            onClick={() => onOpenServerPicker(shiftId, role.code)}
            className="w-full flex items-center justify-center gap-1 rounded border border-dashed border-red-400 bg-white hover:bg-red-50 text-red-700 text-[10px] font-semibold py-1 transition"
            title={`Add a ${role.code} to this shift`}
          >
            <Plus className="h-3 w-3" />
            <span>Add {role.code} ({open} open)</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Full shift card used in the day-grid view. Phase 14: header is a
 * collapse/expand toggle, collapsed by default. When collapsed only the
 * BEO #, time, location, staffed total + manager chip show. When expanded
 * the per-role slots reveal.
 */
export function ShiftCard({
  shift,
  expanded,
  onToggleExpand,
  onRemove,
  onToggleLock,
  onCallout,
  onOpenServerPicker,
  onOpenManagerPicker,
  onClearManager,
  conflictIds,
}: {
  shift: Shift;
  expanded: boolean;
  onToggleExpand: (shiftId: string) => void;
  onRemove: (id: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  onCallout?: (a: Assignment) => void;
  onOpenServerPicker: (shiftId: string, roleCode: string) => void;
  onOpenManagerPicker: (beoId: string) => void;
  onClearManager?: (beoId: string) => void;
  conflictIds: Set<string>;
}) {
  if (shift.statusCode !== "NONE") {
    return (
      <div
        className={`rounded-lg border p-2 text-xs ${
          STATUS_COLORS[shift.statusCode] ?? "bg-canvas-soft border-ink/15"
        }`}
      >
        <div className="font-semibold uppercase tracking-wider text-[10px]">
          {shift.statusCode}
        </div>
        {shift.assignments.map((a) => (
          <div key={a.id} className="text-[11px]">
            {a.server.lastName}, {a.server.firstName}
          </div>
        ))}
      </div>
    );
  }

  const totalReq = shift.requirements.reduce((s, r) => s + r.count, 0);
  const activeAssignments = shift.assignments.filter((a) => !a.calledOut);
  const calledOut = shift.assignments.filter((a) => a.calledOut);
  const totalAssigned = activeAssignments.length;
  const isUnderfilled = totalAssigned < totalReq;
  const isOverfilled = totalAssigned > totalReq;

  const guests = shift.event?.beo?.expectedGuests ?? shift.event?.guests ?? null;
  const beoId = shift.event?.beo?.id ?? null;
  const beoNumber = shift.event?.beo?.beoNumber ?? null;
  const manager = shift.event?.beo?.manager ?? null;

  return (
    <div
      className={`rounded-lg border bg-white overflow-hidden ${
        isUnderfilled
          ? "border-red-200"
          : isOverfilled
            ? "border-amber-300"
            : "border-ink/15"
      }`}
    >
      <button
        type="button"
        onClick={() => onToggleExpand(shift.id)}
        className="w-full text-left px-2 py-1.5 bg-canvas-soft/60 border-b border-ink/10 hover:bg-canvas-soft transition"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-ink-muted shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-ink-muted shrink-0" />
          )}
          {beoNumber && (
            <span className="font-display font-bold text-2xl leading-none text-cardinal shrink-0">
              #{beoNumber}
            </span>
          )}
          <span className="font-mono text-[11px] text-ink ml-auto shrink-0">
            {fmtTime(shift.startsAt)} – {fmtTime(shift.endsAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="text-xs font-medium truncate">
            {shift.label ?? shift.event?.name ?? "Shift"}
          </div>
          <span className="text-[10px] text-ink-muted font-mono shrink-0">
            {[shift.locationCode, shift.roomCode].filter(Boolean).join("/")}
          </span>
        </div>
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
        {beoId && (
          <div onClick={(e) => e.stopPropagation()}>
            <ManagerSlot
              beoId={beoId}
              manager={manager}
              onOpenManagerPicker={onOpenManagerPicker}
              onClearManager={onClearManager}
            />
          </div>
        )}
      </button>
      {expanded && (
        <div className="p-1.5 space-y-1">
          {shift.requirements.map((req) => {
            const filled = shift.assignments.filter(
              (a) => a.roleCode === req.role.code,
            );
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
                onOpenServerPicker={onOpenServerPicker}
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
      )}
    </div>
  );
}
