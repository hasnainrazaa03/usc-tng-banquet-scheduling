"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Printer,
  Wand2,
  LayoutGrid,
  Rows3,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { ShiftCard } from "./components/ShiftCard";
import { RosterGrid } from "./components/RosterGrid";
import { ServersDrawer } from "./components/ServersDrawer";
import { ManagersDrawer } from "./components/ManagersDrawer";
import { WeekNavigator } from "./components/WeekNavigator";
import { ScheduleOpsPanel } from "./components/ScheduleOpsPanel";
import { CalloutModal } from "./components/CalloutModal";
import {
  DOW,
  dayKey,
  type BoardData,
  type Shift,
  type Assignment,
} from "./types";

type View = "day" | "roster";
type Density = "comfortable" | "compact";

const PREFS_KEY = "usc-pec-board-prefs";

type Prefs = { view: View; density: Density };
const DEFAULT_PREFS: Prefs = { view: "day", density: "comfortable" };

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      view: parsed.view === "roster" ? "roster" : "day",
      density: parsed.density === "compact" ? "compact" : "comfortable",
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export default function ScheduleBoard({ data }: { data: BoardData }) {
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>(data.shifts);
  const [busy, setBusy] = useState(false);
  const [runToast, setRunToast] = useState<
    | { kind: "ok" | "err"; message: string }
    | null
  >(null);
  const [calloutTarget, setCalloutTarget] = useState<{ a: Assignment; shift: Shift } | null>(null);

  // Picker state — Phase 14 replaces the always-open drag drawers with
  // on-demand pickers that open from a "+" button on a role/manager slot.
  const [serverPicker, setServerPicker] = useState<
    { shiftId: string; roleCode: string } | null
  >(null);
  const [managerPicker, setManagerPicker] = useState<{ beoId: string } | null>(null);

  // BEO-level collapsible roster state. By default ALL shifts start collapsed
  // (server names hidden); clicking the header chevron expands a card.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>("day");
  const [density, setDensity] = useState<Density>("comfortable");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const p = loadPrefs();
    setView(p.view);
    setDensity(p.density);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ view, density }));
    } catch {
      /* ignore quota errors */
    }
  }, [view, density, hydrated]);

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

  /**
   * Group shifts by operational-week day, and DEDUPE so each BEO renders
   * exactly one card per day. When a BEO has multiple sections (e.g.
   * Reception + Plated Dinner) or stale shifts from prior `syncBeoShifts`
   * runs, we keep the earliest-starting shift as the representative card.
   * Shifts without a BEO (rare in current data) are always kept.
   */
  const byDay = useMemo(() => {
    const m: Record<string, Shift[]> = {
      SUN: [], MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [],
    };
    // First pass: bucket per-day, picking one Shift per BEO (earliest start).
    const perDayByBeo: Record<string, Map<string, Shift>> = {
      SUN: new Map(), MON: new Map(), TUE: new Map(), WED: new Map(),
      THU: new Map(), FRI: new Map(), SAT: new Map(),
    };
    const perDayLooseShifts: Record<string, Shift[]> = {
      SUN: [], MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [],
    };
    for (const s of shifts) {
      const dk = dayKey(s.date);
      if (!(dk in perDayByBeo)) continue;
      const beoId = s.event?.beo?.id ?? null;
      if (!beoId) {
        perDayLooseShifts[dk].push(s);
        continue;
      }
      const existing = perDayByBeo[dk].get(beoId);
      if (!existing) {
        perDayByBeo[dk].set(beoId, s);
      } else {
        const a = new Date(s.startsAt).getTime();
        const b = new Date(existing.startsAt).getTime();
        if (a < b) perDayByBeo[dk].set(beoId, s);
      }
    }
    for (const dk of Object.keys(m) as (keyof typeof m)[]) {
      const combined = [
        ...Array.from(perDayByBeo[dk].values()),
        ...perDayLooseShifts[dk],
      ];
      combined.sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
      m[dk] = combined;
    }
    return m;
  }, [shifts]);

  /**
   * Phase 14: overlap conflicts are now INFORMATIONAL only.
   *
   * The same server may be assigned across different venues during
   * overlapping windows (e.g. a manager intentionally pulling someone for
   * a quick BAR shift at the next building over). We still flag the chips
   * with an amber ring + tooltip so the user can see what's happening, but
   * the API no longer 409s and the UI no longer treats it as a hard error.
   */
  const conflictIds = useMemo(() => {
    const map = new Map<string, { start: number; end: number; id: string }[]>();
    const set = new Set<string>();
    for (const sh of shifts) {
      if (sh.statusCode !== "NONE") continue;
      const start = new Date(sh.startsAt).getTime();
      const end = new Date(sh.endsAt).getTime();
      for (const a of sh.assignments) {
        if (a.calledOut) continue;
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

  async function persistSetBeoManager(beoId: string, managerId: string | null) {
    const res = await fetch(`/api/beos/${beoId}/manager`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerId }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Failed to update manager");
      router.refresh();
      return null;
    }
    return res.json();
  }

  function applyManagerLocal(
    beoId: string,
    manager: { id: string; name: string } | null,
  ) {
    setShifts((prev) =>
      prev.map((sh) => {
        if (!sh.event?.beo || sh.event.beo.id !== beoId) return sh;
        return {
          ...sh,
          event: { ...sh.event, beo: { ...sh.event.beo, manager } },
        };
      }),
    );
  }

  function toggleExpand(shiftId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(shiftId)) next.delete(shiftId);
      else next.add(shiftId);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(shifts.map((s) => s.id)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  function openServerPicker(shiftId: string, roleCode: string) {
    setServerPicker({ shiftId, roleCode });
  }

  function openManagerPicker(beoId: string) {
    setManagerPicker({ beoId });
  }

  async function handleServerPick(serverId: string) {
    if (!serverPicker) return;
    const { shiftId, roleCode } = serverPicker;
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
    setServerPicker(null);
  }

  async function handleManagerPick(managerId: string) {
    if (!managerPicker) return;
    const { beoId } = managerPicker;
    const candidate = data.managers.find((m) => m.id === managerId);
    if (candidate) {
      applyManagerLocal(beoId, { id: candidate.id, name: candidate.name });
    }
    await persistSetBeoManager(beoId, managerId);
    setManagerPicker(null);
  }

  async function rerunUnlocked() {
    setBusy(true);
    setRunToast(null);
    try {
      const res = await fetch("/api/schedule/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: data.schedule.id, clearFirst: false }),
      });
      const raw = await res.text();
      let parsed: { filled?: number; unfilled?: number; error?: string } | null = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { error: `Server returned ${res.status}` };
        }
      }
      if (!res.ok || parsed?.error) {
        setRunToast({
          kind: "err",
          message: parsed?.error ?? `Request failed (${res.status})`,
        });
      } else {
        setRunToast({
          kind: "ok",
          message: `Fill Unassigned: ${parsed?.filled ?? 0} filled, ${parsed?.unfilled ?? 0} still unfilled.`,
        });
        router.refresh();
      }
    } catch (err) {
      setRunToast({
        kind: "err",
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setBusy(false);
      setTimeout(() => setRunToast(null), 6000);
    }
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
  const onClearManager = async (beoId: string) => {
    applyManagerLocal(beoId, null);
    await persistSetBeoManager(beoId, null);
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

  const totalReq = shifts.reduce(
    (s, sh) => s + sh.requirements.reduce((x, r) => x + r.count, 0),
    0,
  );
  const totalAssigned = shifts.reduce(
    (s, sh) => s + sh.assignments.filter((a) => !a.calledOut).length,
    0,
  );
  const totalOpen = Math.max(0, totalReq - totalAssigned);
  const totalCalledOut = shifts.reduce(
    (s, sh) => s + sh.assignments.filter((a) => a.calledOut).length,
    0,
  );

  function openCallout(a: Assignment) {
    const parent = shifts.find((sh) => sh.assignments.some((x) => x.id === a.id));
    if (parent) setCalloutTarget({ a, shift: parent });
  }

  const drawerOpen = serverPicker !== null || managerPicker !== null;

  const dayCardCls =
    density === "compact"
      ? "card !p-2 min-h-[160px] flex flex-col text-[11px]"
      : "card !p-3 min-h-[240px] flex flex-col text-[12px]";
  const dayMinWidth =
    density === "compact" ? "min-w-[980px]" : "min-w-[1180px]";

  return (
    <div
      className="space-y-4 transition-[padding] duration-200"
      style={{ paddingRight: drawerOpen ? 348 : 0 }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl md:text-4xl font-display tracking-tight truncate">
            {data.schedule.name}
          </h1>
          <p className="text-ink-muted text-sm mt-1">
            Operational week runs Thursday → Wednesday. Click the “+” on a
            role slot to add a server; click the manager slot to assign a
            manager. The same person can be used across multiple venues.
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
          {totalCalledOut > 0 && (
            <StatBadge
              label="Sick"
              value={totalCalledOut}
              tone="danger"
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
            />
          )}
          {conflictIds.size > 0 && (
            <StatBadge
              label="Stacked"
              value={conflictIds.size}
              tone="warn"
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
          <a
            href={`/api/export?kind=schedule&scheduleId=${data.schedule.id}`}
            className="btn-outline"
          >
            Export CSV
          </a>
        </div>
      </div>

      <WeekNavigator
        weekStart={data.schedule.weekStart}
        weekEnd={data.schedule.weekEnd}
        siblings={data.siblingSchedules ?? []}
      />

      {runToast && (
        <div
          role="status"
          className={`rounded-lg border px-3 py-2 text-sm ${
            runToast.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {runToast.message}
        </div>
      )}

      <ScheduleOpsPanel
        currentScheduleId={data.schedule.id}
        currentWeekStart={data.schedule.weekStart}
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
          {view === "day" && (
            <div className="inline-flex rounded-lg border border-ink/10 overflow-hidden">
              <button
                type="button"
                onClick={expandAll}
                className="px-2.5 py-1 text-xs bg-white hover:bg-canvas-soft inline-flex items-center gap-1"
                title="Expand all BEO cards"
              >
                <ChevronDown className="h-3 w-3" />
                Expand all
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2.5 py-1 text-xs bg-white hover:bg-canvas-soft border-l border-ink/10 inline-flex items-center gap-1"
                title="Collapse all BEO cards"
              >
                <ChevronUp className="h-3 w-3" />
                Collapse all
              </button>
            </div>
          )}
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
        </div>
      </div>

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
                    className={`${dayCardCls} ${isWeekend ? "bg-gold-50/40" : ""}`}
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
                            expanded={expanded.has(sh.id)}
                            onToggleExpand={toggleExpand}
                            onRemove={onRemove}
                            onToggleLock={onToggleLock}
                            onCallout={openCallout}
                            onClearManager={onClearManager}
                            onOpenServerPicker={openServerPicker}
                            onOpenManagerPicker={openManagerPicker}
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
        open={serverPicker !== null}
        context={serverPicker}
        shifts={shifts}
        onClose={() => setServerPicker(null)}
        onPick={handleServerPick}
        filterRoles={allRoles}
        filterLocations={allLocations}
        density={density}
      />

      <ManagersDrawer
        managers={data.managers}
        open={managerPicker !== null}
        context={managerPicker}
        shifts={shifts}
        onClose={() => setManagerPicker(null)}
        onPick={handleManagerPick}
      />

      <CalloutModal
        assignment={calloutTarget?.a ?? null}
        shift={calloutTarget?.shift ?? null}
        onClose={() => setCalloutTarget(null)}
        onResolved={() => router.refresh()}
      />
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
  tone?: "ok" | "danger" | "warn";
  icon?: React.ReactNode;
}) {
  const cls =
    tone === "danger"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-canvas-soft text-ink border-ink/10";
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {icon}
      <span className="opacity-70">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}
