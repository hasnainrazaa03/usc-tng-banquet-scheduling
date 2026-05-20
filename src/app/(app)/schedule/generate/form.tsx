"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateForm() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay());
    return d.toISOString().slice(0, 10);
  });
  const [name, setName] = useState("Weekly schedule");
  const [clearFirst, setClearFirst] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setBusy(true); setResult(null);
    const res = await fetch("/api/schedule/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, name, clearFirst }),
    });
    const j = await res.json();
    setResult(j);
    setBusy(false);
    if (res.ok && j.scheduleId) router.refresh();
  }

  return (
    <div className="card p-6 grid lg:grid-cols-3 gap-4">
      <div>
        <label className="label">Schedule name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label">Week starting (Sunday)</label>
        <input className="input" type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={clearFirst} onChange={(e) => setClearFirst(e.target.checked)} />
          Clear unlocked assignments first
        </label>
      </div>
      <div className="lg:col-span-3 flex justify-end">
        <button className="btn-primary" onClick={run} disabled={busy}>{busy ? "Running…" : "Run Auto-Schedule"}</button>
      </div>
      {result && (
        <div className="lg:col-span-3 bg-canvas-soft rounded-lg p-4 space-y-2 text-sm">
          <div><strong>{result.filled}</strong> filled, <strong>{result.unfilled}</strong> unfilled</div>
          {result.scheduleId && (
            <a className="text-cardinal underline" href={`/schedule/board?id=${result.scheduleId}`}>Open board →</a>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer">Decision log ({result.decisions?.length ?? 0})</summary>
            <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(result.decisions, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
