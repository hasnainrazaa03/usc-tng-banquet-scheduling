"use client";
import { useMemo } from "react";

type Schedule = {
  id: string;
  name: string;
  weekStart: string;
  weekEnd: string;
  revisionDate: string | null;
  status: string;
  notes: string | null;
};
type Shift = {
  id: string;
  date: string;
  startsAt: string;
  endsAt: string;
  locationCode: string | null;
  roomCode: string | null;
  label: string | null;
  statusCode: string;
  requirements: { roleCode: string; count: number }[];
  assignments: {
    id: string;
    serverId: string;
    roleCode: string | null;
    server: { id: string; firstName: string; lastName: string };
  }[];
};
type Server = {
  id: string;
  firstName: string;
  lastName: string;
  classification: string;
  seniorityRank: number | null;
};

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

const STATUS_BG: Record<string, string> = {
  OFF: "bg-gray-200",
  VAC: "bg-amber-100",
  MLA: "bg-sky-100",
  SICK: "bg-red-100",
  HOLIDAY: "bg-violet-100",
  TRAINING: "bg-emerald-100",
};

const ROLE_BG: Record<string, string> = {
  CAP: "bg-cardinal-100 border-cardinal-300",
  SVR: "bg-white border-ink/20",
  BAR: "bg-gold-100 border-gold-300",
  BBK: "bg-gold-50 border-gold-200",
  HSP: "bg-canvas-soft border-ink/20",
  AV: "bg-sky-50 border-sky-200",
  SUP: "bg-cardinal-200 border-cardinal-400",
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const am = h < 12;
  h = h % 12 || 12;
  return m === 0 ? `${h}${am ? "a" : "p"}` : `${h}:${String(m).padStart(2, "0")}${am ? "a" : "p"}`;
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function PrintSchedule({
  schedule,
  shifts,
  servers,
}: {
  schedule: Schedule;
  shifts: Shift[];
  servers: Server[];
}) {
  type Cell = { time: string; loc: string; role: string; label: string; status: string };
  const cells = useMemo(() => {
    const m: Record<string, Record<string, Cell[]>> = {};
    for (const s of servers) m[s.id] = { SUN: [], MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [] };
    for (const sh of shifts) {
      const dow = DOW[new Date(sh.date).getDay()];
      if (sh.statusCode !== "NONE") {
        for (const a of sh.assignments) {
          m[a.serverId]?.[dow]?.push({ time: "", loc: "", role: "", label: "", status: sh.statusCode });
        }
      } else {
        for (const a of sh.assignments) {
          m[a.serverId]?.[dow]?.push({
            time: `${fmtTime(sh.startsAt)}-${fmtTime(sh.endsAt)}`,
            loc: [sh.locationCode, sh.roomCode].filter(Boolean).join("/"),
            role: a.roleCode ?? "",
            label: sh.label ?? "",
            status: "NONE",
          });
        }
      }
    }
    return m;
  }, [shifts, servers]);

  // Open shifts (unfilled requirements)
  const openShifts = useMemo(() => {
    const out: { date: string; time: string; loc: string; label: string; role: string; missing: number }[] = [];
    for (const sh of shifts) {
      if (sh.statusCode !== "NONE") continue;
      const dow = DOW[new Date(sh.date).getDay()];
      for (const req of sh.requirements) {
        const filled = sh.assignments.filter((a) => a.roleCode === req.roleCode).length;
        if (filled < req.count) {
          out.push({
            date: `${dow} ${new Date(sh.date).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}`,
            time: `${fmtTime(sh.startsAt)}-${fmtTime(sh.endsAt)}`,
            loc: [sh.locationCode, sh.roomCode].filter(Boolean).join("/"),
            label: sh.label ?? "",
            role: req.roleCode,
            missing: req.count - filled,
          });
        }
      }
    }
    return out;
  }, [shifts]);

  // Totals per server (working shifts)
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const sh of shifts) {
      if (sh.statusCode !== "NONE") continue;
      const hours = (new Date(sh.endsAt).getTime() - new Date(sh.startsAt).getTime()) / 3_600_000;
      for (const a of sh.assignments) {
        t[a.serverId] = (t[a.serverId] ?? 0) + hours;
      }
    }
    return t;
  }, [shifts]);

  return (
    <div className="paper-sheet print-card p-6">
      {/* Header */}
      <div className="border-b-2 border-cardinal pb-3 mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="font-display text-2xl leading-tight">USC Town &amp; Gown / Private Events &amp; Conferences</div>
          <div className="text-sm">Weekly Banquet Schedule</div>
          <div className="text-xs text-ink-muted mt-1">{schedule.name}</div>
        </div>
        <div className="text-right text-[11px] leading-tight">
          <div><strong>Week:</strong> {fmtDate(schedule.weekStart)} – {fmtDate(schedule.weekEnd)}</div>
          <div><strong>Revision:</strong> {schedule.revisionDate ? fmtDate(schedule.revisionDate) : "—"}</div>
          <div><strong>Status:</strong> {schedule.status}</div>
        </div>
      </div>

      {/* Grid */}
      <table className="w-full text-[10px] border-collapse">
        <colgroup>
          <col style={{ width: "11%" }} />
          {DOW.map((d) => (
            <col key={d} style={{ width: `${(100 - 11 - 6) / 7}%` }} />
          ))}
          <col style={{ width: "6%" }} />
        </colgroup>
        <thead>
          <tr>
            <th className="border border-ink/30 px-1 py-1 text-left bg-cardinal text-white">Server</th>
            {DOW.map((d, i) => {
              const date = new Date(schedule.weekStart);
              date.setDate(date.getDate() + i);
              return (
                <th key={d} className="border border-ink/30 px-1 py-1 text-center bg-cardinal text-white">
                  <div className="leading-tight">{d}</div>
                  <div className="font-normal text-[9px] leading-tight">
                    {date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
                  </div>
                </th>
              );
            })}
            <th className="border border-ink/30 px-1 py-1 text-center bg-cardinal text-white">Hrs</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((s) => {
            const hasAny = DOW.some((d) => (cells[s.id]?.[d] ?? []).length > 0);
            return (
              <tr
                key={s.id}
                className={`print-row align-top ${!hasAny ? "print-empty-row" : ""}`}
              >
                <td className="border border-ink/30 px-1 py-1 bg-canvas-soft">
                  <div className="font-semibold whitespace-nowrap leading-tight">
                    {s.lastName}, {s.firstName}
                  </div>
                  <div className="text-[9px] text-ink-muted leading-tight">
                    #{s.seniorityRank ?? "—"} · {s.classification.replace("_", " ")}
                  </div>
                </td>
                {DOW.map((d) => {
                  const list = cells[s.id]?.[d] ?? [];
                  return (
                    <td key={d} className="border border-ink/30 p-0.5 align-top">
                      <div className="space-y-0.5">
                        {list.map((e, i) => (
                          <div
                            key={i}
                            className={`schedule-cell rounded border px-1 py-0.5 text-[9px] leading-tight ${
                              e.status !== "NONE" ? `${STATUS_BG[e.status]} border-ink/20` : ROLE_BG[e.role] ?? "bg-white border-ink/20"
                            }`}
                          >
                            {e.status !== "NONE" ? (
                              <div className="text-center font-bold">{e.status}</div>
                            ) : (
                              <>
                                <div className="font-mono">{e.time}</div>
                                <div>
                                  <strong>{e.role}</strong> · {e.loc}
                                </div>
                                {e.label && <div className="truncate text-[8px] opacity-70">{e.label}</div>}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                })}
                <td className="border border-ink/30 px-1 py-1 text-center font-mono text-[10px]">
                  {totals[s.id] ? totals[s.id].toFixed(1) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Open shifts callout */}
      {openShifts.length > 0 && (
        <div className="mt-3 border border-red-300 bg-red-50 rounded p-2">
          <div className="font-semibold text-red-900 text-[11px] mb-1">
            ⚠ Open Shifts ({openShifts.reduce((s, o) => s + o.missing, 0)} positions)
          </div>
          <table className="w-full text-[9px]">
            <thead>
              <tr className="text-left">
                <th className="px-1">Day</th>
                <th className="px-1">Time</th>
                <th className="px-1">Location</th>
                <th className="px-1">Role</th>
                <th className="px-1 text-right">Need</th>
                <th className="px-1">Event</th>
              </tr>
            </thead>
            <tbody>
              {openShifts.map((o, i) => (
                <tr key={i} className="border-t border-red-200">
                  <td className="px-1 font-semibold">{o.date}</td>
                  <td className="px-1 font-mono">{o.time}</td>
                  <td className="px-1">{o.loc}</td>
                  <td className="px-1 font-semibold">{o.role}</td>
                  <td className="px-1 text-right font-mono">{o.missing}</td>
                  <td className="px-1 truncate">{o.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer / legend */}
      <div className="mt-3 pt-2 border-t border-ink/20 text-[9px] space-y-1.5">
        <div>
          <strong>Meal break reminder:</strong> All shifts ≥ 5h require a 30-minute unpaid meal break.
        </div>
        {schedule.notes && (
          <div>
            <strong>Notes:</strong> {schedule.notes}
          </div>
        )}
        <div className="grid grid-cols-4 md:grid-cols-7 gap-1 mt-1">
          {Object.entries({
            CAP: "Captain",
            SVR: "Server",
            BAR: "Bartender",
            BBK: "Barback",
            HSP: "Houseperson",
            AV: "AV Tech",
            SUP: "Supervisor",
          }).map(([k, v]) => (
            <div key={k} className={`px-1 py-0.5 rounded border ${ROLE_BG[k] ?? "bg-white border-ink/15"}`}>
              <strong>{k}</strong> {v}
            </div>
          ))}
          {Object.entries({
            OFF: "Off",
            VAC: "Vacation",
            MLA: "Mil/Med Leave",
            SICK: "Sick",
            HOLIDAY: "Holiday",
            TRAINING: "Training",
          }).map(([k, v]) => (
            <div key={k} className={`px-1 py-0.5 rounded border border-ink/15 ${STATUS_BG[k] ?? "bg-white"}`}>
              <strong>{k}</strong> {v}
            </div>
          ))}
        </div>
        <div className="text-[8px] text-ink-muted pt-1 text-right">
          Generated {new Date().toLocaleString("en-US")} · USC TNG Banquet Operations
        </div>
      </div>
    </div>
  );
}
