"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext, type DragEndEvent, type DragStartEvent, DragOverlay,
  PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
} from "@dnd-kit/core";
import { Lock, Unlock, X, Printer, Wand2, Search } from "lucide-react";
import Link from "next/link";

type Server = {
  id: string; firstName: string; lastName: string; classification: string;
  preferredLocations: string[]; preferredShifts: string[];
  seniority?: { seniorityRank: number | null; seniorityScore: number; yearsOfService: number };
  qualifications: { qualification: { code: string; name: string } }[];
};
type Assignment = {
  id: string; serverId: string; roleCode: string | null;
  locked: boolean; acknowledged: boolean; reason: string | null;
  server: Server;
};
type Requirement = { id: string; count: number; role: { id: string; code: string; name: string; color: string | null } };
type Shift = {
  id: string; date: string; startsAt: string; endsAt: string;
  locationCode: string | null; roomCode: string | null;
  label: string | null; statusCode: string;
  requirements: Requirement[]; assignments: Assignment[];
  event: { id: string; name: string } | null;
};
type Schedule = { id: string; name: string; weekStart: string; weekEnd: string; status: string; revisionDate: string | null };

const DOW = ["SUN","MON","TUE","WED","THU","FRI","SAT"] as const;

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function dayKey(iso: string) {
  const d = new Date(iso);
  return DOW[d.getDay()];
}

export default function ScheduleBoard({ data }: { data: { schedule: Schedule; shifts: Shift[]; servers: Server[] } }) {
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>(data.shifts);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterLoc, setFilterLoc] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const allRoles = useMemo(() => {
    const set = new Set<string>();
    shifts.forEach((s) => s.requirements.forEach((r) => set.add(r.role.code)));
    return Array.from(set).sort();
  }, [shifts]);

  const allLocations = useMemo(() => {
    const set = new Set<string>();
    shifts.forEach((s) => s.locationCode && set.add(s.locationCode));
    return Array.from(set).sort();
  }, [shifts]);

  // Group shifts by day
  const byDay = useMemo(() => {
    const m: Record<string, Shift[]> = { SUN:[], MON:[], TUE:[], WED:[], THU:[], FRI:[], SAT:[] };
    for (const s of shifts) m[dayKey(s.date)]?.push(s);
    return m;
  }, [shifts]);

  // Filtered sidebar servers
  const filteredServers = useMemo(() => {
    const q = filterQuery.toLowerCase();
    return data.servers.filter((s) => {
      if (q) {
        const name = `${s.firstName} ${s.lastName}`.toLowerCase();
        if (!name.includes(q)) return false;
      }
      if (filterLoc && !s.preferredLocations.includes(filterLoc)) return false;
      if (filterRole) {
        // Approximate match by classification
        const classMatch = (s.classification ?? "").includes(filterRole.toUpperCase()) ||
          (filterRole === "CAP" && s.classification.includes("CAPTAIN")) ||
          (filterRole === "BAR" && s.classification === "BARTENDER") ||
          (filterRole === "SVR" && s.classification === "BANQUET_SERVER") ||
          (filterRole === "AV" && s.classification === "AV_TECH") ||
          (filterRole === "HSP" && s.classification === "HOUSEPERSON");
        if (!classMatch) return false;
      }
      return true;
    });
  }, [data.servers, filterQuery, filterRole, filterLoc]);

  async function persistAssign(shiftId: string, serverId: string, roleCode?: string) {
    const res = await fetch("/api/schedule/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId, serverId, roleCode }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Failed to assign");
      router.refresh();
      return null;
    }
    return res.json();
  }

  async function persistRemove(assignmentId: string) {
    const res = await fetch(`/api/schedule/assign?id=${assignmentId}`, { method: "DELETE" });
    return res.ok;
  }

  async function toggleLock(assignmentId: string, locked: boolean) {
    await fetch("/api/schedule/assign", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: assignmentId, locked }),
    });
  }

  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const dragId = String(active.id);
    const overId = String(over.id);

    // Drop target id formats:
    //   shift:<shiftId>:<roleCode>
    if (!overId.startsWith("shift:")) return;
    const [, shiftId, roleCode] = overId.split(":");

    // Active id formats: server:<serverId>  OR  assignment:<assignmentId>
    if (dragId.startsWith("server:")) {
      const serverId = dragId.replace("server:", "");
      // Optimistic
      const result = await persistAssign(shiftId, serverId, roleCode);
      if (result) {
        setShifts((prev) =>
          prev.map((s) =>
            s.id === shiftId ? { ...s, assignments: [...s.assignments, result] } : s
          )
        );
      }
    } else if (dragId.startsWith("assignment:")) {
      const assignmentId = dragId.replace("assignment:", "");
      // Find source shift + server
      const fromShift = shifts.find((s) => s.assignments.some((a) => a.id === assignmentId));
      const a = fromShift?.assignments.find((x) => x.id === assignmentId);
      if (!a || !fromShift) return;
      if (fromShift.id === shiftId) return;
      await persistRemove(assignmentId);
      const result = await persistAssign(shiftId, a.serverId, roleCode);
      if (result) {
        setShifts((prev) =>
          prev.map((s) => {
            if (s.id === fromShift.id) return { ...s, assignments: s.assignments.filter((x) => x.id !== assignmentId) };
            if (s.id === shiftId) return { ...s, assignments: [...s.assignments, result] };
            return s;
          })
        );
      }
    }
  }

  async function rerunUnlocked() {
    setBusy(true);
    await fetch("/api/schedule/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleId: data.schedule.id, clearFirst: false }),
    });
    setBusy(false);
    router.refresh();
  }

  const activeServer = activeId?.startsWith("server:")
    ? data.servers.find((s) => s.id === activeId.replace("server:", ""))
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-4xl">{data.schedule.name}</h1>
          <p className="text-ink-muted text-sm">
            Drag servers from the sidebar onto unfilled role slots. Lock assignments to protect them from auto-scheduling.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={rerunUnlocked} disabled={busy}>
            <Wand2 className="h-4 w-4" />{busy ? "Running…" : "Fill Unassigned"}
          </button>
          <Link href={`/schedule/print?id=${data.schedule.id}`} className="btn-primary">
            <Printer className="h-4 w-4" />Print View
          </Link>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-[280px_1fr] gap-4">
          {/* Sidebar */}
          <aside className="card p-4 sticky top-20 self-start max-h-[80vh] overflow-y-auto">
            <h2 className="font-display text-lg mb-3">Available Servers</h2>
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2 bg-canvas-soft rounded-lg px-2 py-1">
                <Search className="h-3 w-3 text-ink-muted" />
                <input value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} placeholder="Search by name…" className="bg-transparent outline-none text-sm flex-1" />
              </div>
              <select className="input" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                <option value="">All roles</option>
                {allRoles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select className="input" value={filterLoc} onChange={(e) => setFilterLoc(e.target.value)}>
                <option value="">All locations</option>
                {allLocations.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              {filteredServers.map((s) => (
                <DraggableServer key={s.id} server={s} />
              ))}
            </div>
          </aside>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-3 min-w-[1000px]">
            {DOW.map((d) => (
              <div key={d} className="card p-3 min-h-[200px]">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-display text-sm uppercase tracking-wider">{d}</div>
                  <div className="text-xs text-ink-muted">{byDay[d]?.length ?? 0} shift{(byDay[d]?.length ?? 0) === 1 ? "" : "s"}</div>
                </div>
                <div className="space-y-2">
                  {(byDay[d] ?? []).map((sh) => (
                    <ShiftCard
                      key={sh.id}
                      shift={sh}
                      onRemove={async (aid) => {
                        if (await persistRemove(aid)) {
                          setShifts((prev) => prev.map((x) => x.id === sh.id ? { ...x, assignments: x.assignments.filter((a) => a.id !== aid) } : x));
                        }
                      }}
                      onToggleLock={async (aid, locked) => {
                        await toggleLock(aid, locked);
                        setShifts((prev) => prev.map((x) => x.id === sh.id ? { ...x, assignments: x.assignments.map((a) => a.id === aid ? { ...a, locked } : a) } : x));
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeServer && (
            <div className="bg-cardinal text-white rounded-lg px-3 py-1.5 text-sm shadow-card">
              {activeServer.lastName}, {activeServer.firstName}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function DraggableServer({ server }: { server: Server }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `server:${server.id}` });
  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners}
      className={`rounded-lg border border-ink/10 px-2.5 py-2 bg-white hover:bg-cardinal/5 cursor-grab active:cursor-grabbing text-sm ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="font-medium">{server.lastName}, {server.firstName}</div>
      <div className="flex items-center justify-between text-[10px] text-ink-muted">
        <span>#{server.seniority?.seniorityRank ?? "—"} · {server.seniority?.yearsOfService.toFixed(1) ?? "0"}y</span>
        <span className="font-mono">{server.classification.split("_")[0]}</span>
      </div>
    </div>
  );
}

function ShiftCard({ shift, onRemove, onToggleLock }: {
  shift: Shift;
  onRemove: (assignmentId: string) => void;
  onToggleLock: (assignmentId: string, locked: boolean) => void;
}) {
  const statusColors: Record<string, string> = {
    OFF: "bg-gray-200 text-gray-700",
    VAC: "bg-amber-100 text-amber-900 border border-amber-200",
    MLA: "bg-sky-100 text-sky-900 border border-sky-200",
    SICK: "bg-red-100 text-red-900 border border-red-200",
    HOLIDAY: "bg-violet-100 text-violet-900 border border-violet-200",
    TRAINING: "bg-emerald-100 text-emerald-900 border border-emerald-200",
  };
  if (shift.statusCode !== "NONE") {
    return (
      <div className={`rounded-lg p-2 text-xs ${statusColors[shift.statusCode] ?? "bg-canvas-soft"}`}>
        <div className="font-semibold">{shift.statusCode}</div>
        {shift.assignments.map((a) => (
          <div key={a.id} className="text-[11px]">{a.server.lastName}, {a.server.firstName}</div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink/10 bg-white p-2 schedule-cell">
      <div className="flex items-center justify-between text-[11px] text-ink-muted">
        <span className="font-mono">{fmtTime(shift.startsAt)}–{fmtTime(shift.endsAt)}</span>
        <span>{shift.locationCode ?? ""}{shift.roomCode ? `/${shift.roomCode}` : ""}</span>
      </div>
      <div className="text-xs font-medium mt-0.5 line-clamp-2">{shift.label ?? "Shift"}</div>

      <div className="mt-2 space-y-1.5">
        {shift.requirements.map((req) => {
          const filled = shift.assignments.filter((a) => a.roleCode === req.role.code);
          const open = req.count - filled.length;
          return (
            <RoleSlot
              key={req.id}
              shiftId={shift.id}
              role={req.role}
              count={req.count}
              assigned={filled}
              open={open}
              onRemove={onRemove}
              onToggleLock={onToggleLock}
            />
          );
        })}
      </div>
    </div>
  );
}

function RoleSlot({
  shiftId, role, count, assigned, open, onRemove, onToggleLock,
}: {
  shiftId: string;
  role: { id: string; code: string; name: string; color: string | null };
  count: number;
  assigned: Assignment[];
  open: number;
  onRemove: (id: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `shift:${shiftId}:${role.code}` });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-md border ${isOver ? "border-cardinal bg-cardinal/5" : open > 0 ? "border-dashed border-red-300 bg-red-50/30" : "border-ink/10 bg-canvas-soft/50"} p-1.5`}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
        <span className="font-semibold" style={{ color: role.color ?? undefined }}>{role.code}</span>
        <span className={`font-mono ${open > 0 ? "text-red-700" : "text-emerald-700"}`}>
          {assigned.length}/{count}
        </span>
      </div>
      <div className="mt-1 space-y-1">
        {assigned.map((a) => (
          <DraggableAssignment key={a.id} a={a} onRemove={onRemove} onToggleLock={onToggleLock} />
        ))}
      </div>
    </div>
  );
}

function DraggableAssignment({ a, onRemove, onToggleLock }: {
  a: Assignment; onRemove: (id: string) => void; onToggleLock: (id: string, locked: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `assignment:${a.id}` });
  return (
    <div
      ref={setNodeRef}
      className={`group flex items-center justify-between gap-1 rounded-md px-1.5 py-1 text-[11px] cursor-grab
        ${a.locked ? "bg-cardinal text-white" : "bg-white border border-ink/10"} ${isDragging ? "opacity-40" : ""}`}
      title={a.reason ?? ""}
    >
      <span {...attributes} {...listeners} className="truncate font-medium">
        {a.server.lastName}, {a.server.firstName[0]}.
      </span>
      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
        <button onClick={() => onToggleLock(a.id, !a.locked)} title={a.locked ? "Unlock" : "Lock"}>
          {a.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
        </button>
        <button onClick={() => onRemove(a.id)} title="Remove"><X className="h-3 w-3" /></button>
      </span>
    </div>
  );
}
