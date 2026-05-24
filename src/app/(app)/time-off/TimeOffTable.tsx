"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Undo2 } from "lucide-react";

export type TimeOffRow = {
  id: string;
  startDate: string; // ISO
  endDate: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "DENIED" | "CANCELLED";
  server: { firstName: string; lastName: string };
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

const STATUS_STYLES: Record<TimeOffRow["status"], string> = {
  APPROVED: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-800",
  DENIED: "bg-red-100 text-red-800",
  CANCELLED: "bg-ink/10 text-ink-muted",
};

export default function TimeOffTable({
  rows,
  canDecide,
}: {
  rows: TimeOffRow[];
  canDecide: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | TimeOffRow["status"]>("ALL");
  const [error, setError] = useState<string | null>(null);

  const filtered = filter === "ALL" ? rows : rows.filter((r) => r.status === filter);
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  async function decide(id: string, status: TimeOffRow["status"]) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/time-off/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const raw = await res.text();
        setError(raw || `Request failed (${res.status})`);
        return;
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", "PENDING", "APPROVED", "DENIED", "CANCELLED"] as const).map((k) => {
          const count = k === "ALL" ? rows.length : counts[k] ?? 0;
          const active = filter === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`pill text-xs ${
                active ? "bg-cardinal text-white" : "bg-canvas-soft text-ink-muted hover:bg-ink/10"
              }`}
            >
              {k} · {count}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="card !p-3 border border-red-200 bg-red-50 text-sm text-red-900">{error}</div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm table-zebra">
          <thead className="bg-canvas-soft text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-4 py-3 text-left">Server</th>
              <th className="px-4 py-3 text-left">Start</th>
              <th className="px-4 py-3 text-left">End</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-left">Status</th>
              {canDecide && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const busy = busyId === r.id || pending;
              return (
                <tr key={r.id} className="border-t border-ink/5">
                  <td className="px-4 py-3 font-medium">
                    {r.server.lastName}, {r.server.firstName}
                  </td>
                  <td className="px-4 py-3">{fmt(r.startDate)}</td>
                  <td className="px-4 py-3">{fmt(r.endDate)}</td>
                  <td className="px-4 py-3">{r.reason ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`pill text-xs ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                  </td>
                  {canDecide && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {r.status === "PENDING" && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => decide(r.id, "APPROVED")}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => decide(r.id, "DENIED")}
                            className="ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" /> Deny
                          </button>
                        </>
                      )}
                      {r.status !== "PENDING" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => decide(r.id, "PENDING")}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold bg-canvas-soft text-ink-muted hover:bg-ink/10 disabled:opacity-50"
                          title="Reset to PENDING"
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Reset
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={canDecide ? 6 : 5}
                  className="px-4 py-10 text-center text-ink-muted"
                >
                  No requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
