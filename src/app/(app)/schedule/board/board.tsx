"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Printer, Wand2, Search, LayoutGrid, Rows3, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { DraggableServer } from "./components/Draggables";
import { ShiftCard } from "./components/ShiftCard";
import { RosterGrid } from "./components/RosterGrid";
import { DOW, dayKey, type BoardData, type Shift } from "./types";

type View = "day" | "roster";

export default function ScheduleBoard({ data }: { data: BoardData }) {
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>(data.shifts);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterLoc, setFilterLoc] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>("day");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

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

  const byDay = useMemo(() => {
    const m: Record<string, Shift[]> = { SUN: [], MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [] };
    for (const s of shifts) m[dayKey(s.date)]?.push(s);
    return m;
  }, [shifts]);

  // Detect overlap conflicts: same server, overlapping time windows.
  const conflictIds = useMemo(() => {
    const map = new Map<string, { start: number; end: number; id: string }[]>();
    const set = new Set<string>();
    for (const sh of shifts) {
      if (sh.statusCode !== "NONE") continue;
      const start = new Date(sh.startsAt).getTime();
      const end = new Date(sh.endsAt).getTime();
      for (const a of sh.assignments) {
        const arr = map.get(a.serverId) ?? [];
        for (const other of arr) {
          if (start < other.end && end > other.start) {
            set.add(a.id);
            set.add(other.id);
          }
        }
        arr.push({ start, end, id: a.id });
        map.set(a.serverId, arr);
      }
    }
    return set;
  }, [shifts]);

  const filteredServers = useMemo(() => {
    const q = filterQuery.toLowerCase();
    return data.servers.filter((s) => {
      if (q) {
        const name = `${s.firstName} ${s.lastName}`.toLowerCase();
        if (!name.includes(q)) return false;
      }
      if (filterLoc && !s.preferredLocations.includes(filterLoc)) return false;
      if (filterRole) {
        const cls = s.classification ?? "";
        const ok =
          (filterRole === "CAP" && cls.includes("CAPTAIN")) ||
          (filterRole === "BAR" && cls === "BARTENDER") ||
          (filterRole === "SVR" && cls === "BANQUET_SERVER") ||
          (filterRole === "AV" && cls === "AV_TECH") ||
          (filterRole === "HSP" && cls === "HOUSEPERSON") ||
          (filterRole === "SUP" && cls.includes("SUPERVISOR")) ||
          cls.includes(filterRole.toUpperCase());
        if (!ok) return false;
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

  async function toggleLockReq(assignmentId: string, locked: boolean) {
    await fetch("/api/schedule/assign", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: assignmentId, locked }),
    });
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const dragId = String(active.id);
    const overId = String(over.id);
    if (!overId.startsWith("shift:")) return;
    const [, shiftId, roleCode] = overId.split(":");

    if (dragId.startsWith("server:")) {
      const serverId = dragId.replace("server:", "");
      const result = await persistAssign(shiftId, serverId, roleCode);
      if (result) {
        setShifts((prev) => prev.map((s) => (s.id === shiftId ? { ...s, assignments: [...s.assignments, result] } : s)));
      }
    } else if (dragId.startsWith("assignment:")) {
      const assignmentId = dragId.replace("assignment:", "");
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
          }),
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

  const onRemove = async (aid: string) => {
    if (await persistRemove(aid)) {
      setShifts((prev) => prev.map((x) => ({ ...x, assignments: x.assignments.filter((a) => a.id !== aid) })));
    }
  };
  const onToggleLock = async (aid: string, locked: boolean) => {
    await toggleLockReq(aid, locked);
    setShifts((prev) =>
      prev.map((x) => ({ ...x, assignments: x.assignments.map((a) => (a.id === aid ? { ...a, locked } : a)) })),
    );
  };

  const activeServer = activeId?.startsWith("server:")
    ? data.servers.find((s) => s.id === activeId.replace("server:", ""))
    : null;

  const totalReq = shifts.reduce((s, sh) => s + sh.requirements.reduce((x, r) => x + r.count, 0), 0);
  const totalAssigned = shifts.reduce((s, sh) => s + sh.assignments.length, 0);
  const totalOpen = Math.max(0, totalReq - totalAssigned);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl md:text-4xl font-display tracking-tight truncate">{data.schedule.name}</h1>
          <p className="text-ink-muted text-sm mt-1">
            Drag servers onto unfilled role slots. Lock to protect from auto-fill.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatBadge label="Open" value={totalOpen} tone={totalOpen > 0 ? "danger" : "ok"} />
          <StatBadge label="Assigned" value={totalAssigned} />
          <StatBadge label="Required" value={totalReq} />
          {conflictIds.size > 0 && (
            <StatBadge label="Conflicts" value={conflictIds.size} tone="danger" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
          )}
          <div className="h-6 w-px bg-ink/10" />
          <button className="btn-outline" onClick={rerunUnlocked} disabled={busy}>
            <Wand2 className="h-4 w-4" />
            {busy ? "Running…" : "Fill Unassigned"}
          </button>
          <Link href={`/schedule/print?id=${data.schedule.id}`} className="btn-primary">
            <Printer className="h-4 w-4" />
            Print
          </Link>
        </div>
      </div>

      <div className="card !p-2 flex flex-wrap items-center gap-2 justify-between">
        <div className="inline-flex rounded-lg border border-ink/10 overflow-hidden bg-canvas-soft/60">
          <button
            onClick={() => setView("day")}
            className={`px-3 py-1.5 text-sm inline-flex items-center gap-1.5 ${view === "day" ? "bg-white text-cardinal font-semibold" : "text-ink-muted hover:bg-white/60"}`}
          >
            <LayoutGrid className="h-4 w-4" /> Day grid
          </button>
          <button
            onClick={() => setView("roster")}
            className={`px-3 py-1.5 text-sm inline-flex items-center gap-1.5 ${view === "roster" ? "bg-white text-cardinal font-semibold" : "text-ink-muted hover:bg-white/60"}`}
          >
            <Rows3 className="h-4 w-4" /> Roster grid
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink-muted">Density</label>
          <div className="inline-flex rounded-lg border border-ink/10 overflow-hidden">
            <button
              onClick={() => setDensity("comfortable")}
              className={`px-2.5 py-1 text-xs ${density === "comfortable" ? "bg-cardinal text-white" : "bg-white hover:bg-canvas-soft"}`}
            >
              Comfortable
            </button>
            <button
              onClick={() => setDensity("compact")}
              className={`px-2.5 py-1 text-xs ${density === "compact" ? "bg-cardinal text-white" : "bg-white hover:bg-canvas-soft"}`}
            >
              Compact
            </button>
          </div>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="card !p-3 lg:sticky lg:top-20 self-start lg:max-h-[calc(100vh-100px)] overflow-hidden flex flex-col">
            <h2 className="font-display text-base mb-2 flex items-center justify-between">
              <span>Available Servers</span>
              <span className="text-[11px] font-mono text-ink-muted">{filteredServers.length}</span>
            </h2>
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2 bg-canvas-soft rounded-lg px-2 py-1.5">
                <Search className="h-3.5 w-3.5 text-ink-muted shrink-0" />
                <input
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Search by name…"
                  className="bg-transparent outline-none text-sm flex-1 min-w-0"
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <select className="input !py-1 !text-xs" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                  <option value="">All roles</option>
                  {allRoles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <select className="input !py-1 !text-xs" value={filterLoc} onChange={(e) => setFilterLoc(e.target.value)}>
                  <option value="">All locs</option>
                  {allLocations.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5 overflow-y-auto pr-1 -mr-1 flex-1">
              {filteredServers.length === 0 ? (
                <div className="text-xs text-ink-muted text-center py-6">No servers match.</div>
              ) : (
                filteredServers.map((s) => <DraggableServer key={s.id} server={s} compact={density === "compact"} />)
              )}
            </div>
          </aside>

          <div className="min-w-0">
            {view === "day" ? (
              <div className="overflow-x-auto pb-2">
                <div className="grid grid-cols-7 gap-3 min-w-[1100px]">
                  {DOW.map((d, i) => {
                    const date = new Date(data.schedule.weekStart);
                    date.setDate(date.getDate() + i);
                    return (
                      <div key={d} className="card !p-2.5 min-h-[220px] flex flex-col">
                        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-ink/10">
                          <div>
                            <div className="font-display text-xs uppercase tracking-wider">{d}</div>
                            <div className="text-[10px] text-ink-muted font-mono">
                              {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </div>
                          </div>
                          <div className="text-[10px] text-ink-muted">
                            {byDay[d]?.length ?? 0} shift{(byDay[d]?.length ?? 0) === 1 ? "" : "s"}
                          </div>
                        </div>
                        <div className="space-y-2 flex-1">
                          {(byDay[d] ?? []).length === 0 ? (
                            <div className="text-[11px] text-ink-muted text-center py-6 italic">No shifts</div>
                          ) : (
                            (byDay[d] ?? []).map((sh) => (
                              <ShiftCard
                                key={sh.id}
                                shift={sh}
                                onRemove={onRemove}
                                onToggleLock={onToggleLock}
                                conflictIds={conflictIds}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <RosterGrid
                schedule={data.schedule}
                shifts={shifts}
                servers={data.servers}
                onRemove={onRemove}
                onToggleLock={onToggleLock}
                conflictIds={conflictIds}
                density={density}
              />
            )}
          </div>
        </div>

        <DragOverlay>
          {activeServer && (
            <div className="bg-cardinal text-white rounded-lg px-3 py-2 text-sm shadow-lg ring-2 ring-cardinal/30">
              <div className="font-medium leading-tight">{activeServer.lastName}, {activeServer.firstName}</div>
              <div className="text-[10px] opacity-80">#{activeServer.seniority?.seniorityRank ?? "—"}</div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function StatBadge({
  label, value, tone, icon,
}: {
  label: string;
  value: number;
  tone?: "ok" | "danger";
  icon?: React.ReactNode;
}) {
  const cls = tone === "danger" ? "bg-red-50 text-red-800 border-red-200" : "bg-canvas-soft text-ink border-ink/10";
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${cls}`}>
      {icon}
      <span className="text-ink-muted">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}
