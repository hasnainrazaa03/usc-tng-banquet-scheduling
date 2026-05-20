import { prisma } from "@/lib/db";
import { fmtDate, fmtTime } from "@/lib/utils";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
const DOW = ["SUN","MON","TUE","WED","THU","FRI","SAT"] as const;

export default async function PrintSchedulePage({ searchParams }: { searchParams: { id?: string } }) {
  const schedule = searchParams.id
    ? await prisma.schedule.findUnique({ where: { id: searchParams.id } })
    : await prisma.schedule.findFirst({ orderBy: { weekStart: "desc" } });

  if (!schedule) {
    return <div className="card p-8 text-center text-ink-muted">No schedule.</div>;
  }

  const [shifts, servers] = await Promise.all([
    prisma.shift.findMany({
      where: { scheduleId: schedule.id },
      include: {
        assignments: { include: { server: { include: { seniority: true } } } },
      },
      orderBy: [{ date: "asc" }, { startsAt: "asc" }],
    }),
    prisma.server.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ seniority: { seniorityRank: "asc" } }, { lastName: "asc" }],
      include: { seniority: true },
    }),
  ]);

  // Build server×day cell map
  type CellEntry = { time: string; loc: string; role: string; label: string; statusCode: string };
  const cells: Record<string, Record<string, CellEntry[]>> = {};
  for (const s of servers) {
    cells[s.id] = { SUN:[], MON:[], TUE:[], WED:[], THU:[], FRI:[], SAT:[] };
  }
  for (const sh of shifts) {
    const dow = DOW[new Date(sh.date).getDay()];
    if (sh.statusCode !== "NONE") {
      for (const a of sh.assignments) {
        cells[a.serverId]?.[dow]?.push({
          time: "", loc: "", role: "", label: "", statusCode: sh.statusCode,
        });
      }
    } else {
      for (const a of sh.assignments) {
        cells[a.serverId]?.[dow]?.push({
          time: `${fmtTime(sh.startsAt)}-${fmtTime(sh.endsAt)}`,
          loc: [sh.locationCode, sh.roomCode].filter(Boolean).join("/"),
          role: a.roleCode ?? "",
          label: sh.label ?? "",
          statusCode: "NONE",
        });
      }
    }
  }

  const statusColor: Record<string, string> = {
    OFF: "bg-gray-200",
    VAC: "bg-amber-100",
    MLA: "bg-sky-100",
    SICK: "bg-red-100",
    HOLIDAY: "bg-violet-100",
    TRAINING: "bg-emerald-100",
  };
  const roleColor: Record<string, string> = {
    CAP: "bg-cardinal-100 border-cardinal-300",
    SVR: "bg-white",
    BAR: "bg-gold-100",
    BBK: "bg-gold-50",
    HSP: "bg-canvas-soft",
    AV:  "bg-sky-50",
    SUP: "bg-cardinal-200",
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between no-print">
        <h1 className="text-3xl font-display">Printable Weekly Schedule</h1>
        <PrintButton />
      </div>

      <div className="print-card card p-6 bg-white">
        {/* Header */}
        <div className="border-b-2 border-cardinal pb-3 mb-3 flex items-center justify-between gap-4">
          <div>
            <div className="font-display text-2xl">USC Town &amp; Gown / Private Events &amp; Conferences</div>
            <div className="text-sm">Weekly Banquet Schedule</div>
          </div>
          <div className="text-right text-xs">
            <div><strong>Week:</strong> {fmtDate(schedule.weekStart)} – {fmtDate(schedule.weekEnd)}</div>
            <div><strong>Revision:</strong> {schedule.revisionDate ? fmtDate(schedule.revisionDate) : "—"}</div>
            <div><strong>Status:</strong> {schedule.status}</div>
          </div>
        </div>

        {/* Grid */}
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr>
              <th className="border border-ink/20 px-1 py-1 text-left bg-cardinal text-white">Server</th>
              {DOW.map((d, i) => {
                const date = new Date(schedule.weekStart); date.setDate(date.getDate() + i);
                return (
                  <th key={d} className="border border-ink/20 px-1 py-1 text-center bg-cardinal text-white">
                    <div>{d}</div>
                    <div className="font-normal text-[9px]">{date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {servers.map((s) => (
              <tr key={s.id} className="align-top">
                <td className="border border-ink/20 px-1 py-1 bg-canvas-soft">
                  <div className="font-semibold whitespace-nowrap">{s.lastName}, {s.firstName}</div>
                  <div className="text-[9px] text-ink-muted">#{s.seniority?.seniorityRank ?? "—"} · {s.classification.replace("_"," ")}</div>
                </td>
                {DOW.map((d) => {
                  const list = cells[s.id]?.[d] ?? [];
                  return (
                    <td key={d} className="border border-ink/20 p-0.5 align-top">
                      <div className="space-y-0.5">
                        {list.map((e, i) => (
                          <div key={i} className={`rounded px-1 py-0.5 text-[9px] leading-tight ${e.statusCode !== "NONE" ? statusColor[e.statusCode] : roleColor[e.role] ?? "bg-white"}`}>
                            {e.statusCode !== "NONE" ? (
                              <div className="text-center font-bold">{e.statusCode}</div>
                            ) : (
                              <>
                                <div className="font-mono">{e.time}</div>
                                <div>{e.role} · {e.loc}</div>
                                {e.label && <div className="truncate text-[8px] opacity-70">{e.label}</div>}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 pt-2 border-t border-ink/10 text-[10px] space-y-1">
          <div><strong>Meal break reminder:</strong> All shifts ≥ 5h require a 30-minute unpaid meal break.</div>
          {schedule.notes && <div><strong>Notes:</strong> {schedule.notes}</div>}
          <div className="grid grid-cols-7 gap-1 mt-2">
            {Object.entries({ OFF:"Off", VAC:"Vacation", MLA:"Mil./Med. Leave", SICK:"Sick", HOLIDAY:"Holiday", TRAINING:"Training", NONE:"Working" }).map(([k,v]) => (
              <div key={k} className={`text-[9px] px-1 py-0.5 rounded ${statusColor[k] ?? "bg-white border border-ink/10"}`}>
                <strong>{k}</strong> {v}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
