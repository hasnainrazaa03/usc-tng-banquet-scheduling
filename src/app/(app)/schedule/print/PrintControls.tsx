"use client";
import { useState, useEffect } from "react";
import { Printer, Settings2 } from "lucide-react";

type Density = "tight" | "normal" | "roomy";
const KEY = "tng-print-density";

export default function PrintControls() {
  const [density, setDensity] = useState<Density>("normal");
  const [hideEmpty, setHideEmpty] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as Density) ?? "normal";
    setDensity(stored);
    applyClass(stored);
    const hideStored = localStorage.getItem(KEY + ":hide-empty") === "1";
    setHideEmpty(hideStored);
    document.documentElement.classList.toggle("print-hide-empty", hideStored);
  }, []);

  function applyClass(d: Density) {
    const root = document.documentElement;
    root.classList.remove("print-density-tight", "print-density-normal", "print-density-roomy");
    root.classList.add(`print-density-${d}`);
  }

  function change(d: Density) {
    setDensity(d);
    localStorage.setItem(KEY, d);
    applyClass(d);
  }

  function toggleHideEmpty() {
    const v = !hideEmpty;
    setHideEmpty(v);
    localStorage.setItem(KEY + ":hide-empty", v ? "1" : "0");
    document.documentElement.classList.toggle("print-hide-empty", v);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden md:flex items-center gap-2 text-xs">
        <Settings2 className="h-4 w-4 text-ink-muted" />
        <span className="text-ink-muted">Density</span>
        <div className="inline-flex rounded-lg border border-ink/10 overflow-hidden">
          {(["tight", "normal", "roomy"] as Density[]).map((d) => (
            <button
              key={d}
              onClick={() => change(d)}
              className={`px-2 py-1 capitalize ${density === d ? "bg-cardinal text-white" : "bg-white hover:bg-canvas-soft"}`}
            >
              {d}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-1 cursor-pointer ml-2">
          <input type="checkbox" checked={hideEmpty} onChange={toggleHideEmpty} className="rounded" />
          <span>Hide empty rows</span>
        </label>
      </div>
      <button className="btn-primary" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        Print / Save PDF
      </button>
    </div>
  );
}
