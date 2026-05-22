"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { startOfOperationalWeek } from "@/lib/week-config";

/**
 * Generate-week form.
 *
 * Always anchors the week-start to the operational Thursday so the user
 * cannot accidentally generate a Sunday-based week. Guards every fetch
 * against empty / non-JSON server responses so the page never crashes
 * with "Unexpected end of JSON input".
 */
export default function GenerateForm() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const thursday = startOfOperationalWeek(today);
    return thursday.toISOString().slice(0, 10);
  });
  const [name, setName] = useState("Weekly schedule");
  const [clearFirst, setClearFirst] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    scheduleId?: string;
    filled?: number;
    unfilled?: number;
    decisions?: unknown[];
    error?: string;
  } | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/schedule/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, name, clearFirst }),
      });

      // Read once as text so we can fall back gracefully if the server
      // returned an empty body or an HTML error page.
      const raw = await res.text();
      let parsed: any = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { error: `Server returned ${res.status} with non-JSON body` };
        }
      }

      if (!res.ok) {
        setResult({ error: parsed?.error ?? `Request failed (${res.status})` });
        return;
      }

      setResult(parsed ?? { error: "Empty server response" });
      if (parsed?.scheduleId) router.refresh();
    } catch (err) {
      setResult({
        error:
          err instanceof Error
            ? err.message
            : "Network error while running schedule",
      });
    } finally {
      setBusy(false);
    }
  }

  // Hint label so the user understands the Thursday anchor.
  const pickedDay = new Date(weekStart + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
  });
  const willAnchorTo = startOfOperationalWeek(new Date(weekStart + "T00:00:00"))
    .toISOString()
    .slice(0, 10);

  return (
    <div className="card p-6 grid lg:grid-cols-3 gap-4">
      <div>
        <label className="label">Schedule name</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Week (operational week starts Thursday)</label>
        <input
          className="input"
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
        />
        <p className="text-[11px] text-ink-muted mt-1">
          Picked {pickedDay}. Will anchor to Thursday <code>{willAnchorTo}</code>.
        </p>
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={clearFirst}
            onChange={(e) => setClearFirst(e.target.checked)}
          />
          Clear unlocked assignments first
        </label>
      </div>
      <div className="lg:col-span-3 flex justify-end">
        <button className="btn-primary" onClick={run} disabled={busy}>
          {busy ? "Running…" : "Run Auto-Schedule"}
        </button>
      </div>

      {result?.error && (
        <div className="lg:col-span-3 rounded-lg border border-red-200 bg-red-50 text-red-900 p-3 text-sm">
          <strong>Could not generate schedule.</strong> {result.error}
        </div>
      )}

      {result && !result.error && (
        <div className="lg:col-span-3 bg-canvas-soft rounded-lg p-4 space-y-2 text-sm">
          <div>
            <strong>{result.filled}</strong> filled, <strong>{result.unfilled}</strong>{" "}
            unfilled
          </div>
          {result.scheduleId && (
            <a
              className="text-cardinal underline"
              href={`/schedule/board?id=${result.scheduleId}`}
            >
              Open board →
            </a>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer">
              Decision log ({result.decisions?.length ?? 0})
            </summary>
            <pre className="mt-2 whitespace-pre-wrap">
              {JSON.stringify(result.decisions, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
