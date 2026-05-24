"use client";
import { Lock, Unlock, X, UserMinus, UserCircle2, Plus } from "lucide-react";
import type { Assignment, Manager, Server } from "../types";

/**
 * Phase 14: static chips/pills. The previous `Draggables.tsx` exposed
 * `useDraggable`-backed pills; assignment now happens via click-to-add
 * (a `+` button on each role/manager slot opens the picker drawer). These
 * components stayed in the same file so the rest of the board UI didn't
 * need import-path churn.
 */

/** Server pill rendered inside the picker drawer. Click to assign. */
export function ServerPickerPill({
  server,
  onPick,
  alreadyOn,
  compact = false,
}: {
  server: Server;
  onPick: () => void;
  /**
   * Optional summary of where this server is already scheduled today /
   * during the week. Cross-venue assignments are NOT blocked — this is
   * informational only.
   */
  alreadyOn?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`
        group w-full text-left rounded-lg border bg-white px-3 py-2
        hover:border-cardinal hover:bg-cardinal/[0.03] hover:shadow-sm
        focus:outline-none focus:ring-2 focus:ring-cardinal/40
        transition-all border-ink/10
        ${compact ? "py-1.5 px-2.5" : ""}
      `}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-medium text-sm leading-tight truncate">
          {server.lastName}, {server.firstName}
        </div>
        <span className="font-mono text-[10px] text-ink-muted shrink-0">
          #{server.seniority?.seniorityRank ?? "—"}
        </span>
      </div>
      {!compact && (
        <div className="flex items-center justify-between text-[10px] text-ink-muted mt-0.5">
          <span>
            {server.seniority?.yearsOfService.toFixed(1) ?? "0"}y ·{" "}
            {server.classification.split("_")[0].toLowerCase()}
          </span>
          <span className="flex gap-0.5">
            {server.qualifications.slice(0, 3).map((q) => (
              <span
                key={q.qualification.code}
                className="rounded bg-canvas-soft px-1 text-[9px]"
              >
                {q.qualification.code}
              </span>
            ))}
          </span>
        </div>
      )}
      {alreadyOn && (
        <div className="mt-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
          Also scheduled: {alreadyOn}
        </div>
      )}
    </button>
  );
}

/**
 * Chip rendered inside a role slot for an existing assignment. No longer
 * draggable. Hover reveals lock / call-out / remove actions.
 */
export function AssignmentChip({
  a,
  onRemove,
  onToggleLock,
  onCallout,
  conflict = false,
}: {
  a: Assignment;
  onRemove: (id: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  onCallout?: (a: Assignment) => void;
  conflict?: boolean;
}) {
  if (a.calledOut) {
    return (
      <div
        className="group flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] bg-red-50 border border-red-200 text-red-900"
        title={a.calledOutReason ?? "Called out"}
      >
        <UserMinus className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate font-medium flex-1 line-through">
          {a.server.lastName}, {a.server.firstName[0]}.
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wider">sick</span>
        {onCallout && (
          <button
            onClick={() => onCallout(a)}
            title="Undo call-out"
            className="opacity-0 group-hover:opacity-100 hover:opacity-70 transition"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    );
  }
  return (
    <div
      className={`
        group flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px]
        transition-colors
        ${a.locked ? "bg-cardinal text-white" : "bg-white border"}
        ${conflict ? "ring-2 ring-amber-400 border-amber-300" : a.locked ? "" : "border-ink/15"}
      `}
      title={
        conflict
          ? "Heads-up: this person is also booked on another overlapping shift (cross-venue is allowed)."
          : (a.reason ?? "")
      }
    >
      {a.locked ? <Lock className="h-2.5 w-2.5 shrink-0 opacity-80" /> : null}
      <span className="truncate font-medium flex-1 select-none">
        {a.server.lastName}, {a.server.firstName[0]}.
      </span>
      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
        {onCallout && (
          <button
            onClick={() => onCallout(a)}
            title="Mark sick / called out"
            className="hover:opacity-70 text-red-600"
          >
            <UserMinus className="h-2.5 w-2.5" />
          </button>
        )}
        <button
          onClick={() => onToggleLock(a.id, !a.locked)}
          title={a.locked ? "Unlock assignment" : "Lock assignment"}
          className="hover:opacity-70"
        >
          {a.locked ? <Unlock className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
        </button>
        <button onClick={() => onRemove(a.id)} title="Remove" className="hover:opacity-70">
          <X className="h-2.5 w-2.5" />
        </button>
      </span>
    </div>
  );
}

/** Manager pill rendered inside the manager picker. Click to assign. */
export function ManagerPickerPill({
  manager,
  onPick,
  alreadyOn,
  compact = false,
}: {
  manager: Manager;
  onPick: () => void;
  alreadyOn?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`
        group w-full text-left rounded-lg border bg-white px-3 py-2
        hover:border-cardinal hover:bg-cardinal/[0.03] hover:shadow-sm
        focus:outline-none focus:ring-2 focus:ring-cardinal/40
        transition-all border-ink/10
        ${compact ? "py-1.5 px-2.5" : ""}
      `}
    >
      <div className="flex items-center gap-2 min-w-0">
        <UserCircle2 className="h-4 w-4 text-cardinal shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm leading-tight truncate">{manager.name}</div>
          {!compact && (
            <div className="text-[10px] text-ink-muted truncate">{manager.email}</div>
          )}
        </div>
        <span className="font-mono text-[9px] text-ink-muted uppercase shrink-0">
          {manager.role}
        </span>
      </div>
      {alreadyOn && (
        <div className="mt-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
          Also assigned: {alreadyOn}
        </div>
      )}
    </button>
  );
}

/**
 * Manager chip rendered inside a BEO's manager slot. Hover reveals "swap"
 * and "clear" actions; swap re-opens the picker for that BEO.
 */
export function ManagerChip({
  beoId,
  manager,
  onSwap,
  onClear,
}: {
  beoId: string;
  manager: { id: string; name: string };
  onSwap: (beoId: string) => void;
  onClear: (beoId: string) => void;
}) {
  return (
    <div
      className="group flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] bg-cardinal-50 border border-cardinal-200 text-cardinal-900"
      title={`Manager: ${manager.name}`}
    >
      <UserCircle2 className="h-3 w-3 shrink-0" />
      <span className="truncate font-medium flex-1 select-none">{manager.name}</span>
      <button
        type="button"
        onClick={() => onSwap(beoId)}
        title="Change manager"
        className="opacity-0 group-hover:opacity-100 hover:opacity-70 transition"
      >
        <Plus className="h-2.5 w-2.5 rotate-45" />
      </button>
      <button
        type="button"
        onClick={() => onClear(beoId)}
        title="Clear manager"
        className="opacity-0 group-hover:opacity-100 hover:opacity-70 transition"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
