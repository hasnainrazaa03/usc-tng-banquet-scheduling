"use client";
import { useEffect, useMemo, useState } from "react";
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
import {
  Printer,
  Wand2,
  LayoutGrid,
  Rows3,
  AlertTriangle,
  Users,
  PanelRightOpen,
} from "lucide-react";
import Link from "next/link";
import { ShiftCard } from "./components/ShiftCard";
import { RosterGrid } from "./components/RosterGrid";
import { ServersDrawer } from "./components/ServersDrawer";
import { WeekNavigator } from "./components/WeekNavigator";
import { DOW, dayKey, type BoardData, type Shift } from "./types";

type View = "day" | "roster";
type Density = "comfortable" | "compact";

const PREFS_KEY = "usc-pec-board-prefs";

type Prefs = { view: View; density: Density; drawerOpen: boolean };
const DEFAULT_PREFS: Prefs = {
  view: "day",
  density: "comfortable",
  drawerOpen: false,
};

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      view: parsed.view === "roster" ? "roster" : "day",
      density: parsed.density === "compact" ? "compact" : "comfortable",
      drawerOpen: Boolean(parsed.drawerOpen),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export default function ScheduleBoard({ data }: { data: BoardData }) {
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>(data.shifts);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Persisted view preferences (hydrated client-side to avoid SSR mismatch).
  const [view, setView] = useState<View>("day");
  const [density, setDensity] = useState<Density>("comfortable");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const p = loadPrefs();
    setView(p.view);
    setDensity(p.density);
    setDrawerOpen(p.drawerOpen);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ view, density, drawerOpen }),
      );
    } catch {
      /* ignore quota errors */
    }
  }, [view, density, drawerOpen, hydrated]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

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
    const m: Record<string, Shift[]> = {
      SUN: [],
      MON: [],
      TUE: [],
      WED: [],
      THU: [],
      FRI: [],
      SAT: [],
    };
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

  async function persistAssign(
    shiftId: string,
    serverId: string,
    roleCode?: string,
  ) {
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
    const res = await fetch(`/api/schedule/assign?id=${assignmentId}`, {
      method: "DELETE",
    });
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
        setShifts((prev) =>
          prev.map((s) =>
            s.id === shiftId
              ? { ...s, assignments: [...s.assignments, result] }
              : s,
          ),
        );
      }
    } else if (dragId.startsWith("assignment:")) {
      const assignmentId = dragId.replace("assignment:", "");
      const fromShift = shifts.find((s) =>
        s.assignments.some((a) => a.id === assignmentId),
      );
      const a = fromShift?.assignments.find((x) => x.id === assignmentId);
      if (!a || !fromShift) return;
      if (fromShift.id === shiftId) return;
      await persistRemove(assignmentId);
      const result = await persistAssign(shiftId, a.serverId, roleCode);
      if (result) {
        setShifts((prev) =>
          prev.map((s) => {
            if (s.id === fromShift.id)
              return {
                ...s,
                assignments: s.assignments.filter((x) => x.id !== assignmentId),
              };
            if (s.id === shiftId)
              return { ...s, assignments: [...s.assignments, result] };
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
      setShifts((prev) =>
        prev.map((x) => ({
          ...x,
          assignments: x.assignments.filter((a) => a.id !== aid),
        })),
      );
    }
  };
  const onToggleLock = async (aid: string, locked: boolean) => {
    await toggleLockReq(aid, locked);
    setShifts((prev) =>
      prev.map((x) => ({
        ...x,
        assignments: x.assignments.map((a) =>
          a.id === aid ? { ...a, locked } : a,
        ),
      })),
    );
  };

  const activeServer = activeId?.startsWith("server:")
    ? data.servers.find((s) => s.id === activeId.replace("server:", ""))
    : null;

  const totalReq = shifts.reduce(
    (s, sh) => s + sh.requirements.reduce((x, r) => x + r.count, 0),
    0,
  );
  const totalAssigned = shifts.reduce((s, sh) => s + sh.assignments.length, 0);
  const totalOpen = Math.max(0, totalReq - totalAssigned);

  // Density-aware sizing for the Day grid. Compact mode shrinks the card
  // header, internal padding, and minimum column height so the user can
  // see more shifts at once without scrolling.
  const dayCardCls =
    density === "compact"
      ? "card !p-2 min-h-[160px] flex flex-col text-[11px]"
      : "card !p-3 min-h-[240px] flex flex-col text-[12px]";
  const dayMinWidth =
    density === "compact" ? "min-w-[980px]" : "min-w-[1180px]";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl md:text-4xl font-display tracking-tight truncate">
            {data.schedule.name}
          </h1>
          <p className="text-ink-muted text-sm mt-1">
            Operational week runs Thursday → Wednesday. Drag servers onto
            unfilled role slots; lock to protect from auto-fill.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatBadge
            label="Open"
            value={totalOpen}
            tone={totalOpen > 0 ? "danger" : "ok"}
          />
          <StatBadge label="Assigned" value={totalAssigned} />
          <StatBadge label="Required" value={totalReq} />
          {conflictIds.size > 0 && (
            <StatBadge
              label="Conflicts"
              value={conflictIds.size}
              tone="danger"
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
            />
          )}
          <div className="h-6 w-px bg-ink/10" />
          <button className="btn-outline" onClick={rerunUnlocked} disabled={busy}>
            <Wand2 className="h-4 w-4" />
            {busy ? "Running…" : "Fill Unassigned"}
          </button>
          <Link
            href={`/schedule/print?id=${data.schedule.id}`}
            className="btn-primary"
          >
            <Printer className="h-4 w-4" />
            Print
          </Link>
        </div>
      </div>

      <WeekNavigator
        weekStart={data.schedule.weekStart}
        weekEnd={data.schedule.weekEnd}
        siblings={data.siblingSchedules ?? []}
      />

      <div className="card !p-2 flex flex-wrap items-center gap-2 justify-between">
        <div className="inline-flex rounded-lg border border-ink/10 overflow-hidden bg-canvas-soft/60">
          <button
            onClick={() => setView("day")}
            className={`px-3 py-1.5 text-sm inline-flex items-center gap-1.5 transition ${
              view === "day"
                ? "bg-white text-cardinal font-semibold shadow-sm"
                : "text-ink-muted hover:bg-white/60"
            }`}
          >
            <LayoutGrid className="h-4 w-4" /> Day grid
          </button>
          <button
            onClick={() => setView("roster")}
            className={`px-3 py-1.5 text-sm inline-flex items-center gap-1.5 transition ${
              view === "roster"
                ? "bg-white text-cardinal font-semibold shadow-sm"
                : "text-ink-muted hover:bg-white/60"
            }`}
          >
            <Rows3 className="h-4 w-4" /> Roster grid
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-ink-muted">Density</label>
          <div className="inline-flex rounded-lg border border-ink/10 overflow-hidden">
            <button
              onClick={() => setDensity("comfortable")}
              className={`px-2.5 py-1 text-xs transition ${
                density === "comfortable"
                  ? "bg-cardinal text-white"
                  : "bg-white hover:bg-canvas-soft"
              }`}
            >
              Comfortable
            </button>
            <button
              onClick={() => setDensity("compact")}
              className={`px-2.5 py-1 text-xs transition ${
                density === "compact"
                  ? "bg-cardinal text-white"
                  : "bg-white hover:bg-canvas-soft"
              }`}
            >
              Compact
            </button>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="btn-primary !px-3 !py-1.5 text-xs"
            title="Open available servers panel"
          >
            <Users className="h-3.5 w-3.5" />
            Servers
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {/* Floating button to reopen drawer on mid-drag */}
        {!drawerOpen && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="fixed bottom-6 right-6 z-20 btn-primary !rounded-full !px-4 !py-3 shadow-lg"
            title="Available servers"
            aria-label="Open available servers"
          >
            <PanelRightOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Servers</span>
          </button>
        )}

        <div className="min-w-0">
          {view === "day" ? (
            <div className="overflow-x-auto pb-2">
              <div className={`grid grid-cols-7 gap-3 ${dayMinWidth}`}>
                {DOW.map((d, i) => {
                  const date = new Date(data.schedule.weekStart);
                  date.setDate(date.getDate() + i);
                  const isWeekend = d === "SAT" || d === "SUN";
                  return (
                    <div
                      key={d}
                      className={`${dayCardCls} ${
                        isWeekend ? "bg-gold-50/40" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-ink/10">
                        <div>
                          <div className="font-display text-xs uppercase tracking-wider">
                            {d}
                          </div>
                          <div className="text-[10px] text-ink-muted font-mono">
                            {date.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                        </div>
                        <div className="text-[10px] text-ink-muted">
                          {byDay[d]?.length ?? 0} shift
                          {(byDay[d]?.length ?? 0) === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="space-y-2 flex-1">
                        {(byDay[d] ?? []).length === 0 ? (
                          <div className="text-[11px] text-ink-muted text-center py-6 italic">
                            No shifts
                          </div>
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

        <ServersDrawer
          servers={data.servers}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          filterRoles={allRoles}
          filterLocations={allLocations}
          density={density}
        />

        <DragOverlay>
          {activeServer && (
            <div className="bg-cardinal text-white rounded-lg px-3 py-2 text-sm shadow-lg ring-2 ring-cardinal/30">
              <div className="font-medium leading-tight">
                {activeServer.lastName}, {activeServer.firstName}
              </div>
              <div className="text-[10px] opacity-80">
                #{activeServer.seniority?.seniorityRank ?? "—"}
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function StatBadge({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone?: "ok" | "danger";
  icon?: React.ReactNode;
}) {
  const cls =
    tone === "danger"
      ? "bg-red-50 text-red-800 border-red-200"
      : "bg-canvas-soft text-ink border-ink/10";
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {icon}
      <span className="text-ink-muted">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}
