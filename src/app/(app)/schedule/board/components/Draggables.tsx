"use client";
import { useDraggable } from "@dnd-kit/core";
import { Lock, Unlock, X, UserMinus, UserCircle2 } from "lucide-react";
import type { Assignment, Manager, Server } from "../types";

/** Server pill draggable from the sidebar / roster. */
export function DraggableServer({
  server,
  compact = false,
}: {
  server: Server;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `server:${server.id}`,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`
        group rounded-lg border bg-white px-3 py-2 cursor-grab active:cursor-grabbing
        hover:border-cardinal hover:bg-cardinal/[0.03] hover:shadow-sm
        transition-all
        ${isDragging ? "opacity-40 ring-2 ring-cardinal" : "border-ink/10"}
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
          <span>{server.seniority?.yearsOfService.toFixed(1) ?? "0"}y · {server.classification.split("_")[0].toLowerCase()}</span>
          <span className="flex gap-0.5">
            {server.qualifications.slice(0, 3).map((q) => (
              <span key={q.qualification.code} className="rounded bg-canvas-soft px-1 text-[9px]">
                {q.qualification.code}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

/** Already-assigned chip — draggable to a different slot, lockable, removable. */
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
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `assignment:${a.id}`,
    disabled: a.calledOut,
  });
  if (a.calledOut) {
    // Render a non-draggable, visibly struck-through chip so the manager can
    // still see who originally had the shift. Restore button lets them undo.
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
      ref={setNodeRef}
      className={`
        group flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px]
        transition-colors
        ${a.locked ? "bg-cardinal text-white" : "bg-white border"}
        ${conflict ? "ring-2 ring-red-500 border-red-300" : a.locked ? "" : "border-ink/15"}
        ${isDragging ? "opacity-40" : ""}
      `}
      title={a.reason ?? ""}
    >
      {a.locked ? (
        <Lock className="h-2.5 w-2.5 shrink-0 opacity-80" />
      ) : null}
      <span
        {...attributes}
        {...listeners}
        className="truncate font-medium flex-1 cursor-grab active:cursor-grabbing select-none"
      >
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

/**
 * Manager pill draggable from the managers drawer.
 *
 * Drag id: `manager:{userId}`. Drop target is a `beo-mgr:{beoId}` zone on
 * any shift card. The drop handler in `board.tsx` resolves the target BEO
 * and PUTs to `/api/beos/{beoId}/manager`.
 */
export function DraggableManager({
  manager,
  compact = false,
}: {
  manager: Manager;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `manager:${manager.id}`,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`
        group rounded-lg border bg-white px-3 py-2 cursor-grab active:cursor-grabbing
        hover:border-cardinal hover:bg-cardinal/[0.03] hover:shadow-sm
        transition-all
        ${isDragging ? "opacity-40 ring-2 ring-cardinal" : "border-ink/10"}
        ${compact ? "py-1.5 px-2.5" : ""}
      `}
    >
      <div className="flex items-center gap-2 min-w-0">
        <UserCircle2 className="h-4 w-4 text-cardinal shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm leading-tight truncate">
            {manager.name}
          </div>
          {!compact && (
            <div className="text-[10px] text-ink-muted truncate">
              {manager.email}
            </div>
          )}
        </div>
        <span className="font-mono text-[9px] text-ink-muted uppercase shrink-0">
          {manager.role}
        </span>
      </div>
    </div>
  );
}

/**
 * Chip rendered inside a shift card showing the currently-assigned manager
 * for the underlying BEO. Draggable to another BEO's manager slot (drag id
 * `manager:{userId}`, exactly the same as the drawer chip so re-assignment
 * goes through the same code path). Clicking the X clears the manager.
 */
export function ManagerChip({
  beoId,
  manager,
  onClear,
}: {
  beoId: string;
  manager: { id: string; name: string };
  onClear: (beoId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `manager:${manager.id}`,
  });
  return (
    <div
      className={`
        group flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]
        bg-cardinal-50 border border-cardinal-200 text-cardinal-900
        ${isDragging ? "opacity-40" : ""}
      `}
      title={`Manager: ${manager.name}`}
    >
      <UserCircle2 className="h-3 w-3 shrink-0" />
      <span
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className="truncate font-medium flex-1 cursor-grab active:cursor-grabbing select-none"
      >
        {manager.name}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClear(beoId);
        }}
        title="Clear manager"
        className="opacity-0 group-hover:opacity-100 hover:opacity-70 transition"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
