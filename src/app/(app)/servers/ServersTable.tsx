"use client";

/**
 * Server database editor — table with inline "Edit" action per row that
 * opens a modal for name / employee ID / hire date. Saving sends a PATCH
 * to /api/servers/[id]; on success the page refreshes so any seniority
 * recalculation triggered by a hire-date change reflects everywhere.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X } from "lucide-react";
import { fmtHireDate } from "@/lib/utils";

export type ServerRow = {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  email: string | null;
  phone: string | null;
  classification: string;
  hireDate: string; // ISO
  status: string;
  seniority: { seniorityRank: number | null; yearsOfService: number; seniorityScore: number } | null;
  qualifications: { id: string; qualification: { code: string; name: string } }[];
};

type EditTarget = {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  hireDate: string; // YYYY-MM-DD
};

export default function ServersTable({ servers }: { servers: ServerRow[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEditor(s: ServerRow) {
    setError(null);
    setEdit({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      employeeId: s.employeeId,
      hireDate: s.hireDate.slice(0, 10),
    });
  }

  async function save() {
    if (!edit) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/servers/${edit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: edit.firstName,
        lastName: edit.lastName,
        employeeId: edit.employeeId,
        hireDate: edit.hireDate,
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

  return (
    <>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-canvas-soft text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-4 py-3 text-left w-16">Rank</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Emp. ID</th>
              <th className="px-4 py-3 text-left">Classification</th>
              <th className="px-4 py-3 text-left">Hire Date</th>
              <th className="px-4 py-3 text-left">Years</th>
              <th className="px-4 py-3 text-left">Score</th>
              <th className="px-4 py-3 text-left">Qualifications</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right w-20">Edit</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((s) => (
              <tr key={s.id} className="border-t border-ink/5 hover:bg-canvas-soft/50">
                <td className="px-4 py-3 font-mono">{s.seniority?.seniorityRank ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {s.lastName}, {s.firstName}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {s.email ?? "—"} · {s.phone ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono">{s.employeeId}</td>
                <td className="px-4 py-3">
                  <span className="pill bg-ink/5">
                    {s.classification.replaceAll("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3">{fmtHireDate(new Date(s.hireDate))}</td>
                <td className="px-4 py-3">
                  {s.seniority?.yearsOfService.toFixed(1) ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono">
                  {s.seniority?.seniorityScore.toFixed(1) ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {s.qualifications.map((q) => (
                      <span
                        key={q.id}
                        className="pill bg-gold-100 text-gold-900 border border-gold-200"
                      >
                        {q.qualification.code}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`pill ${
                      s.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-ink/10"
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openEditor(s)}
                    className="btn-ghost !p-1.5"
                    title="Edit server"
                    aria-label="Edit server"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
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
                <h2 className="font-display text-xl leading-tight">Edit server</h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Changing hire date recalculates seniority for the whole
                  roster in a single transaction.
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
                <span className="text-xs text-ink-muted">First name</span>
                <input
                  className="input w-full"
                  value={edit.firstName}
                  onChange={(e) => setEdit({ ...edit, firstName: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-xs text-ink-muted">Last name</span>
                <input
                  className="input w-full"
                  value={edit.lastName}
                  onChange={(e) => setEdit({ ...edit, lastName: e.target.value })}
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs text-ink-muted">Employee ID</span>
              <input
                className="input w-full font-mono"
                value={edit.employeeId}
                onChange={(e) => setEdit({ ...edit, employeeId: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-xs text-ink-muted">Hire date</span>
              <input
                type="date"
                className="input w-full"
                value={edit.hireDate}
                onChange={(e) => setEdit({ ...edit, hireDate: e.target.value })}
              />
            </label>

            {error && (
              <div className="text-xs text-cardinal bg-cardinal-50 border border-cardinal-200 rounded px-2 py-1.5">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setEdit(null)}
                disabled={busy}
                className="btn-outline"
              >
                Cancel
              </button>
              <button onClick={save} disabled={busy} className="btn-primary">
                <Save className="h-4 w-4" />
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
