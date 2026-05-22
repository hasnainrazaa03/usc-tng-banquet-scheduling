"use client";
import { useState } from "react";
import { Search, UserCircle2, X } from "lucide-react";
import { DraggableManager } from "./Draggables";
import type { Manager } from "../types";

/**
 * Floating side panel for "Available Managers" — drag a manager from here
 * onto a BEO's manager slot on any shift card. Mirrors `ServersDrawer`:
 * non-modal right-edge panel with no scrim so drags from the panel land
 * cleanly on droppable cells in the schedule grid behind it.
 */
export function ManagersDrawer({
  managers,
  open,
  onClose,
}: {
  managers: Manager[];
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const filtered = managers.filter((m) => {
    if (query && !m.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (roleFilter && m.role !== roleFilter) return false;
    return true;
  });

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
        <div className="flex items-center gap-2">
          <UserCircle2 className="h-4 w-4" />
          <h2 className="font-display text-base">Available Managers</h2>
          <span className="pill bg-white/15 border border-white/20 text-white text-[10px]">
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
          Tip: drop a manager onto any BEO&apos;s manager slot to assign. Drop
          on another BEO&apos;s slot to reassign; click the X on a chip to
          clear.
        </div>
      </div>

      <div className="overflow-y-auto h-[calc(100%-180px)] p-3 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-xs text-ink-muted text-center py-10">
            No managers match.
          </div>
        ) : (
          filtered.map((m) => <DraggableManager key={m.id} manager={m} />)
        )}
      </div>
    </aside>
  );
}
