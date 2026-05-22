"use client";
import { useEffect, useState } from "react";
import { X, UserMinus, AlertTriangle, Loader2 } from "lucide-react";
import type { Assignment, Shift } from "../types";

/**
 * Call-out + replacement modal.
 *
 * Three-phase flow, all manager-driven:
 *
 *   1. CONFIRM   — manager confirms the original server is truly absent,
 *                  optionally records a reason.
 *   2. SUGGEST   — server is marked called-out; replacement suggestions are
 *                  fetched (ranked by the same rules as the auto-scheduler,
 *                  but no auto-assignment happens).
 *   3. PICK      — manager explicitly picks one suggestion to assign, or
 *                  closes the modal to leave the slot open for now.
 */
type Candidate = {
  serverId: string;
  name: string;
  seniorityRank: number | null;
  score: number;
  reasons: string[];
};

type Phase = "confirm" | "loading" | "suggest" | "assigning" | "done" | "error";

export function CalloutModal({
  assignment,
  shift,
  onClose,
  onResolved,
}: {
  assignment: Assignment | null;
  shift: Shift | null;
  onClose: () => void;
  /** Called after the modal performed an action that changed the shift's
   *  assignments. The board uses this to refresh its local state. */
  onResolved: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [reason, setReason] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (assignment) {
      setPhase("confirm");
      setReason("");
      setCandidates([]);
      setError(null);
    }
  }, [assignment?.id]);

  if (!assignment || !shift) return null;

  async function safeFetchJson(url: string, init?: RequestInit) {
    const res = await fetch(url, init);
    const raw = await res.text();
    let parsed: any = null;
    if (raw) {
      try { parsed = JSON.parse(raw); } catch { /* fall through */ }
    }
    if (!res.ok) {
      throw new Error(parsed?.error ?? `Request failed (${res.status})`);
    }
    return parsed ?? {};
  }

  async function confirmCallout() {
    if (!assignment) return;
    setPhase("loading");
    setError(null);
    try {
      await safeFetchJson("/api/schedule/callout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignment.id,
          calledOut: true,
          reason: reason.trim() || undefined,
        }),
      });
      // Now fetch replacement suggestions.
      const data = await safeFetchJson("/api/schedule/replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: assignment.id, limit: 8 }),
      });
      setCandidates(data.candidates ?? []);
      setPhase("suggest");
      onResolved(); // call-out itself is already a state change
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark called out");
      setPhase("error");
    }
  }

  async function assignReplacement(serverId: string) {
    if (!shift || !assignment) return;
    setPhase("assigning");
    setError(null);
    try {
      await safeFetchJson("/api/schedule/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: shift.id,
          serverId,
          roleCode: assignment.roleCode,
        }),
      });
      setPhase("done");
      onResolved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign replacement");
      setPhase("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <UserMinus className="h-4 w-4 text-red-600" />
            <h2 className="font-display text-lg">Call-out &amp; replacement</h2>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-sm">
          <div className="rounded-md bg-canvas-soft px-3 py-2">
            <div className="font-medium">
              {assignment.server.lastName}, {assignment.server.firstName}
            </div>
            <div className="text-xs text-ink-muted">
              {shift.label ?? "Shift"} · {shift.locationCode ?? "—"}
              {shift.roomCode ? `/${shift.roomCode}` : ""}
            </div>
          </div>

          {phase === "confirm" && (
            <>
              <p className="text-ink-muted text-xs">
                Confirm that this server is truly absent before marking the slot
                open. The original assignment stays on record for audit.
              </p>
              <label className="label">Reason (optional)</label>
              <input
                className="input"
                placeholder="e.g. called out sick, no-show"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn-outline" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={confirmCallout}>
                  Confirm call-out
                </button>
              </div>
            </>
          )}

          {phase === "loading" && (
            <div className="flex items-center gap-2 py-6 justify-center text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Finding replacements…</span>
            </div>
          )}

          {phase === "suggest" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-ink-muted">
                  Top replacement suggestions (manager picks — nothing is
                  auto-assigned).
                </p>
                {candidates.length === 0 && (
                  <span className="text-xs text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> none eligible
                  </span>
                )}
              </div>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {candidates.map((c) => (
                  <div
                    key={c.serverId}
                    className="flex items-center justify-between gap-2 rounded-md border border-ink/10 px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{c.name}</div>
                      <div className="text-[10px] text-ink-muted truncate">
                        #{c.seniorityRank ?? "—"} · {c.reasons.join(" · ")}
                      </div>
                    </div>
                    <button
                      className="btn-primary !px-2 !py-1 text-xs shrink-0"
                      onClick={() => assignReplacement(c.serverId)}
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-1">
                <button className="btn-outline" onClick={onClose}>
                  Leave slot open
                </button>
              </div>
            </>
          )}

          {phase === "assigning" && (
            <div className="flex items-center gap-2 py-6 justify-center text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Assigning replacement…</span>
            </div>
          )}

          {phase === "done" && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-2 text-sm">
              Replacement assigned.
              <div className="flex justify-end pt-2">
                <button className="btn-primary" onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          )}

          {phase === "error" && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-900 px-3 py-2 text-sm">
              {error ?? "Something went wrong."}
              <div className="flex justify-end pt-2">
                <button className="btn-outline" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
