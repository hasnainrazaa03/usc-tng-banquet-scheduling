"use client";
import { useState } from "react";
import { Search, Users, X } from "lucide-react";
import { DraggableServer } from "./Draggables";
import type { Server } from "../types";

/**
 * Floating side panel for "Available Servers".
 *
 * The MVP used a fixed-width 300px column that ate ~25 % of the viewport.
 * For long week views with 7 day columns this left the schedule grid
 * cramped on anything smaller than a 24" monitor. We trade that constant
 * sidebar for an on-demand drawer so the schedule grid gets the full width
 * by default; the drawer slides in over the grid when the user wants to
 * drop a server.
 */
export function ServersDrawer({
  servers,
  open,
  onClose,
  filterRoles,
  filterLocations,
  density,
}: {
  servers: Server[];
  open: boolean;
  onClose: () => void;
  filterRoles: string[];
  filterLocations: string[];
  density: "comfortable" | "compact";
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [loc, setLoc] = useState("");

  const filtered = servers.filter((s) => {
    if (query) {
      const name = `${s.firstName} ${s.lastName}`.toLowerCase();
      if (!name.includes(query.toLowerCase())) return false;
    }
    if (loc && !s.preferredLocations.includes(loc)) return false;
    if (role) {
      const cls = s.classification ?? "";
      const ok =
        (role === "CAP" && cls.includes("CAPTAIN")) ||
        (role === "BAR" && cls === "BARTENDER") ||
        (role === "SVR" && cls === "BANQUET_SERVER") ||
        (role === "AV" && cls === "AV_TECH") ||
        (role === "HSP" && cls === "HOUSEPERSON") ||
        (role === "SUP" && cls.includes("SUPERVISOR")) ||
        cls.includes(role.toUpperCase());
      if (!ok) return false;
    }
    return true;
  });

  return (
    <>
      {/* Scrim — clicking dismisses; keeps drag interactions safe */}
      <div
        className={`fixed inset-0 z-30 bg-ink/30 backdrop-blur-[1px] transition-opacity ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 z-40 h-full w-[360px] max-w-[92vw] bg-white shadow-2xl border-l border-ink/10 transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Available servers"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink/10 bg-gradient-to-r from-cardinal to-cardinal-700 text-white">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <h2 className="font-display text-base">Available Servers</h2>
            <span className="pill bg-white/15 border border-white/20 text-white text-[10px]">
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
              <option value="">All roles</option>
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
            Tip: keep this panel open while you drag servers onto role slots.
          </div>
        </div>

        <div className="overflow-y-auto h-[calc(100%-160px)] p-3 space-y-1.5">
          {filtered.length === 0 ? (
            <div className="text-xs text-ink-muted text-center py-10">
              No servers match.
            </div>
          ) : (
            filtered.map((s) => (
              <DraggableServer
                key={s.id}
                server={s}
                compact={density === "compact"}
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
}
