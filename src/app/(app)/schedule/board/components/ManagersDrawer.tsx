"use client";
import { useMemo, useState } from "react";
import { Search, UserCircle2, X } from "lucide-react";
import { ManagerPickerPill } from "./Draggables";
import type { Manager, Shift } from "../types";

/**
 * Phase 14: click-to-add manager picker. Opens scoped to a specific BEO;
 * picking a manager PUTs them onto that BEO. Cross-venue duplicates are
 * allowed (we just show an informational badge if the manager is already
 * assigned elsewhere).
 */
export function ManagersDrawer({
  managers,
  open,
  context,
  shifts,
  onClose,
  onPick,
}: {
  managers: Manager[];
  open: boolean;
  context: { beoId: string } | null;
  shifts: Shift[];
  onClose: () => void;
  onPick: (managerId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Build "already assigned" map: managerId → list of BEO #s elsewhere.
  const alreadyOnByManager = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const sh of shifts) {
      const beo = sh.event?.beo;
      if (!beo?.manager) continue;
      if (context && beo.id === context.beoId) continue;
      const arr = map.get(beo.manager.id) ?? [];
      const label = beo.beoNumber ? `BEO #${beo.beoNumber}` : beo.postAs;
      if (!arr.includes(label)) arr.push(label);
      map.set(beo.manager.id, arr);
    }
    const flat = new Map<string, string>();
    for (const [k, v] of map.entries()) flat.set(k, v.join(", "));
    return flat;
  }, [shifts, context]);

  const filtered = managers.filter((m) => {
    if (query && !m.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (roleFilter && m.role !== roleFilter) return false;
    return true;
  });

  // Find the target BEO label for the header.
  const targetBeoLabel = useMemo(() => {
    if (!context) return null;
    for (const sh of shifts) {
      const b = sh.event?.beo;
      if (b?.id === context.beoId) return b.beoNumber ? `BEO #${b.beoNumber}` : b.postAs;
    }
    return null;
  }, [context, shifts]);

  return (
    <aside
      className={`fixed top-0 right-0 z-40 h-full w-[340px] max-w-[92vw] bg-white shadow-2xl border-l border-ink/10 transition-transform ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      style={{ willChange: "transform" }}
      aria-label="Available managers"
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink/10 bg-gradient-to-r from-cardinal to-cardinal-700 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <UserCircle2 className="h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <h2 className="font-display text-base leading-tight">Assign Manager</h2>
            {targetBeoLabel && (
              <div className="text-[10px] opacity-90 truncate">{targetBeoLabel}</div>
            )}
          </div>
          <span className="pill bg-white/15 border border-white/20 text-white text-[10px] shrink-0">
            {filtered.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/15 focusable"
          aria-label="Close managers panel"
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
        <select
          className="input !py-1.5 !text-xs w-full"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All roles</option>
          <option value="MANAGER">Manager</option>
          <option value="ADMIN">Admin</option>
        </select>
        <div className="text-[10px] text-ink-muted">
          Click a manager to assign them to this BEO.
        </div>
      </div>

      <div className="overflow-y-auto h-[calc(100%-180px)] p-3 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-xs text-ink-muted text-center py-10">
            No managers match.
          </div>
        ) : (
          filtered.map((m) => (
            <ManagerPickerPill
              key={m.id}
              manager={m}
              alreadyOn={alreadyOnByManager.get(m.id)}
              onPick={() => onPick(m.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
