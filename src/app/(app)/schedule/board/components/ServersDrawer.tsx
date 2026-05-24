"use client";
import { useMemo, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { ServerPickerPill } from "./Draggables";
import { fmtTime, type Server, type Shift } from "../types";

/**
 * Phase 14: click-to-add server picker.
 *
 * Replaces the always-open "Available servers" drag-and-drop sidebar. Opens
 * with a (shiftId, roleCode) context — the user clicks a server pill and we
 * assign that server to the slot via `onPick`.
 *
 * Cross-venue duplicates are allowed: if a server is already scheduled on
 * another shift today we show an informational badge but do NOT block.
 */
export function ServersDrawer({
  servers,
  open,
  context,
  shifts,
  onClose,
  onPick,
  filterRoles,
  filterLocations,
  density,
}: {
  servers: Server[];
  open: boolean;
  /** When set, the picker is targeted at a specific role on a specific shift. */
  context: { shiftId: string; roleCode: string } | null;
  shifts: Shift[];
  onClose: () => void;
  onPick: (serverId: string) => void;
  filterRoles: string[];
  filterLocations: string[];
  density: "comfortable" | "compact";
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [loc, setLoc] = useState("");

  // Pre-fill the role filter from the target slot, so when the user opens the
  // picker for a SVR slot they see SVR-classified servers first.
  const effectiveRole = role || context?.roleCode || "";

  const targetShift = useMemo(
    () => (context ? shifts.find((s) => s.id === context.shiftId) ?? null : null),
    [context, shifts],
  );

  // Build an "already scheduled today" map so each pill can warn the manager
  // they're stacking the server (allowed, just flagged).
  const alreadyOnByServer = useMemo(() => {
    if (!targetShift) return new Map<string, string>();
    const day = targetShift.date.slice(0, 10);
    const map = new Map<string, string[]>();
    for (const sh of shifts) {
      if (sh.date.slice(0, 10) !== day) continue;
      if (sh.id === targetShift.id) continue;
      for (const a of sh.assignments) {
        if (a.calledOut) continue;
        const arr = map.get(a.serverId) ?? [];
        arr.push(
          `${[sh.locationCode, sh.roomCode].filter(Boolean).join("/") || sh.label || "Shift"} ${fmtTime(sh.startsAt)}`,
        );
        map.set(a.serverId, arr);
      }
    }
    const flat = new Map<string, string>();
    for (const [k, v] of map.entries()) flat.set(k, v.join(", "));
    return flat;
  }, [targetShift, shifts]);

  const filtered = servers.filter((s) => {
    if (query) {
      const name = `${s.firstName} ${s.lastName}`.toLowerCase();
      if (!name.includes(query.toLowerCase())) return false;
    }
    if (loc && !s.preferredLocations.includes(loc)) return false;
    if (effectiveRole) {
      const cls = s.classification ?? "";
      const ok =
        (effectiveRole === "CAP" && cls.includes("CAPTAIN")) ||
        (effectiveRole === "BAR" && cls === "BARTENDER") ||
        (effectiveRole === "SVR" && cls === "BANQUET_SERVER") ||
        (effectiveRole === "AV" && cls === "AV_TECH") ||
        (effectiveRole === "HSP" && cls === "HOUSEPERSON") ||
        cls.includes(effectiveRole.toUpperCase());
      if (!ok) return false;
    }
    return true;
  });

  return (
    <aside
      className={`fixed top-0 right-0 z-40 h-full w-[340px] max-w-[92vw] bg-white shadow-2xl border-l border-ink/10 transition-transform ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      style={{ willChange: "transform" }}
      aria-label="Available servers"
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink/10 bg-gradient-to-r from-cardinal to-cardinal-700 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <h2 className="font-display text-base leading-tight">
              {context ? `Add ${context.roleCode}` : "Available Servers"}
            </h2>
            {targetShift && (
              <div className="text-[10px] opacity-90 truncate">
                {targetShift.event?.beo?.beoNumber
                  ? `BEO #${targetShift.event.beo.beoNumber} · `
                  : ""}
                {fmtTime(targetShift.startsAt)} – {fmtTime(targetShift.endsAt)} ·{" "}
                {[targetShift.locationCode, targetShift.roomCode]
                  .filter(Boolean)
                  .join("/")}
              </div>
            )}
          </div>
          <span className="pill bg-white/15 border border-white/20 text-white text-[10px] shrink-0">
            {filtered.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/15 focusable"
          aria-label="Close servers panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 space-y-2 border-b border-ink/10">
        <div className="flex items-center gap-2 bg-canvas-soft rounded-lg px-2 py-1.5">
          <Search className="h-3.5 w-3.5 text-ink-muted shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className="bg-transparent outline-none text-sm flex-1 min-w-0"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            className="input !py-1.5 !text-xs"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">
              {context ? `${context.roleCode} only` : "All roles"}
            </option>
            {filterRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            className="input !py-1.5 !text-xs"
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
          >
            <option value="">All locations</option>
            {filterLocations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="text-[10px] text-ink-muted">
          {context
            ? "Click a server to assign them to this slot."
            : "Pick a “+” slot on a shift to assign a server."}
        </div>
      </div>

      <div className="overflow-y-auto h-[calc(100%-180px)] p-3 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-xs text-ink-muted text-center py-10">
            No servers match.
          </div>
        ) : (
          filtered.map((s) => (
            <ServerPickerPill
              key={s.id}
              server={s}
              compact={density === "compact"}
              alreadyOn={alreadyOnByServer.get(s.id)}
              onPick={() => onPick(s.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
