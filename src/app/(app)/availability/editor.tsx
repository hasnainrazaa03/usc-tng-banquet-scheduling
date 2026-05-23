"use client";

/**
 * Availability editor — per-server, per-day editable table.
 *
 * Click any cell to open a small inline editor for that (server × day)
 * cell. Saving sends a PUT to /api/availability, removing clears it.
 * The table mirrors the auto-scheduler's view of availability: empty cell
 * = unavailable that day; filled cell = available within the time window.
 *
 * Edits affect scheduling logic immediately — the next auto-fill run
 * (`POST /api/schedule/run`) and the server drawer's filters on the board
 * both read the same `Availability` rows we write here.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Save, Trash2, Pencil } from "lucide-react";

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
type Dow = (typeof DOW)[number];

export type AvailabilityRow = {
  id: string;
  dayOfWeek: Dow;
  startTime: string;
  endTime: string;
  preference: number;
  notes: string | null;
};

export type AvailabilityServer = {
  id: string;
  firstName: string;
  lastName: string;
  rows: AvailabilityRow[];
};

type EditTarget = {
  serverId: string;
  serverLabel: string;
  dayOfWeek: Dow;
  startTime: string;
  endTime: string;
  notes: string;
  existingId: string | null;
};

export default function AvailabilityEditor({ servers }: { servers: AvailabilityServer[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEditor(server: AvailabilityServer, day: Dow) {
    const row = server.rows.find((r) => r.dayOfWeek === day);
    setError(null);
    setEdit({
      serverId: server.id,
      serverLabel: `${server.lastName}, ${server.firstName}`,
      dayOfWeek: day,
      startTime: row?.startTime ?? "09:00",
      endTime: row?.endTime ?? "17:00",
      notes: row?.notes ?? "",
      existingId: row?.id ?? null,
    });
  }

  async function save() {
    if (!edit) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serverId: edit.serverId,
        dayOfWeek: edit.dayOfWeek,
        startTime: edit.startTime,
        endTime: edit.endTime,
        notes: edit.notes || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to save");
      return;
    }
    setEdit(null);
    router.refresh();
  }

  async function remove() {
    if (!edit?.existingId) {
      setEdit(null);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/availability?id=${edit.existingId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to delete");
      return;
    }
    setEdit(null);
    router.refresh();
  }

  return (
    <>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas-soft text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-4 py-3 text-left">Server</th>
              {DOW.map((d) => (
                <th key={d} className="px-3 py-3">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {servers.map((s) => {
              const byDay = new Map(s.rows.map((r) => [r.dayOfWeek, r] as const));
              return (
                <tr key={s.id} className="border-t border-ink/5">
                  <td className="px-4 py-2 font-medium whitespace-nowrap">
                    {s.lastName}, {s.firstName}
                  </td>
                  {DOW.map((d) => {
                    const row = byDay.get(d);
                    return (
                      <td key={d} className="px-3 py-2 text-center">
                        <button
                          onClick={() => openEditor(s, d)}
                          className="group inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-canvas-soft"
                          title="Click to edit availability"
                        >
                          {row ? (
                            <span className="font-mono text-xs">
                              {row.startTime}–{row.endTime}
                            </span>
                          ) : (
                            <span className="text-ink-muted">—</span>
                          )}
                          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {edit && (
        <div
          className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
          onClick={() => !busy && setEdit(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl leading-tight">
                  Availability — {edit.serverLabel}
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  {edit.dayOfWeek}. Leave blank to mark unavailable for the day.
                </p>
              </div>
              <button
                onClick={() => setEdit(null)}
                className="btn-ghost !p-1.5"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-ink-muted">Start</span>
                <input
                  type="time"
                  value={edit.startTime}
                  onChange={(e) => setEdit({ ...edit, startTime: e.target.value })}
                  className="input w-full"
                />
              </label>
              <label className="block">
                <span className="text-xs text-ink-muted">End</span>
                <input
                  type="time"
                  value={edit.endTime}
                  onChange={(e) => setEdit({ ...edit, endTime: e.target.value })}
                  className="input w-full"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs text-ink-muted">Notes (optional)</span>
              <input
                type="text"
                value={edit.notes}
                onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                placeholder="e.g. prefers morning shifts"
                className="input w-full"
              />
            </label>

            {error && (
              <div className="text-xs text-cardinal bg-cardinal-50 border border-cardinal-200 rounded px-2 py-1.5">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={remove}
                disabled={busy || !edit.existingId}
                className="btn-ghost text-cardinal disabled:opacity-40"
                title={edit.existingId ? "Clear this day" : "Nothing to clear"}
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => setEdit(null)} disabled={busy} className="btn-outline">
                  Cancel
                </button>
                <button onClick={save} disabled={busy} className="btn-primary">
                  <Save className="h-4 w-4" />
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
