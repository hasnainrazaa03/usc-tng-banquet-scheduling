"use client";
import { useDraggable } from "@dnd-kit/core";
import { Lock, Unlock, X } from "lucide-react";
import type { Assignment, Server } from "../types";

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
  conflict = false,
}: {
  a: Assignment;
  onRemove: (id: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  conflict?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `assignment:${a.id}`,
  });
  return (
    <div
      ref={setNodeRef}
      className={`
        group flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] cursor-grab
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
      <span {...attributes} {...listeners} className="truncate font-medium flex-1">
        {a.server.lastName}, {a.server.firstName[0]}.
      </span>
      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
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
