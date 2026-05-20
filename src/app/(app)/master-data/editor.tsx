"use client";
import { useState } from "react";

export default function MasterDataEditor({ initialPayload, initialVersion }: { initialPayload: any; initialVersion: number }) {
  const [text, setText] = useState(JSON.stringify(initialPayload ?? {}, null, 2));
  const [version, setVersion] = useState(initialVersion);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const payload = JSON.parse(text);
      const res = await fetch("/api/master-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const j = await res.json();
      if (res.ok) {
        setMsg(`Saved as version ${j.versionNum}.`);
        setVersion(j.versionNum);
      } else {
        setMsg("Save failed: " + (j.error ?? "unknown"));
      }
    } catch (e: any) {
      setMsg("Invalid JSON: " + e.message);
    }
    setBusy(false);
  }

  function download() {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "banquet_master_data.json"; a.click();
    URL.revokeObjectURL(url);
  }

  async function onUpload(file: File) {
    const t = await file.text();
    setText(t);
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm">
          Current version: <span className="font-mono">{version}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="btn-outline cursor-pointer">
            Import JSON
            <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          </label>
          <button className="btn-ghost" onClick={download}>Export</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save Version"}</button>
        </div>
      </div>
      <textarea className="input font-mono text-xs h-[60vh]" value={text} onChange={(e) => setText(e.target.value)} />
      {msg && <div className="text-sm text-ink-muted">{msg}</div>}
    </div>
  );
}
