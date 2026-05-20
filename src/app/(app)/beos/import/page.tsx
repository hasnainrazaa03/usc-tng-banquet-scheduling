"use client";
import { useState } from "react";

export default function BEOImportPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function parse() {
    setBusy(true);
    const res = await fetch("/api/beos/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setBusy(false);
    setResult(await res.json());
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-4xl">Import BEO</h1>
        <p className="text-ink-muted">Paste raw BEO text or upload structured JSON. The AI parser extracts staffing needs automatically.</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6 space-y-3">
          <label className="label">Raw BEO text</label>
          <textarea
            className="input font-mono text-xs h-80"
            placeholder="Post As: USC Dornsife Gala&#10;Account: USC Dornsife College&#10;Booking ID: BK-2026-1042&#10;Guests: 220&#10;Start Time: 17:00&#10;End Time: 22:30&#10;..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button className="btn-primary" disabled={busy || !text.trim()} onClick={parse}>
              {busy ? "Parsing…" : "Parse & Preview"}
            </button>
          </div>
        </div>
        <div className="card p-6 space-y-3">
          <h2 className="text-lg">Parsed result</h2>
          <pre className="text-xs whitespace-pre-wrap bg-canvas-soft p-3 rounded-lg min-h-[18rem]">
            {result ? JSON.stringify(result, null, 2) : "—"}
          </pre>
        </div>
      </div>
    </div>
  );
}
