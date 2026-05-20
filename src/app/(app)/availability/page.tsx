import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
const DOW = ["SUN","MON","TUE","WED","THU","FRI","SAT"] as const;

export default async function AvailabilityPage() {
  const servers = await prisma.server.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ seniority: { seniorityRank: "asc" } }],
    include: { availability: true, seniority: true },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">Availability</h1>
        <p className="text-ink-muted">Default availability windows per server. Employees can update theirs from their account.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas-soft text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-4 py-3 text-left">Server</th>
              {DOW.map((d) => <th key={d} className="px-3 py-3">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {servers.map((s) => {
              const map = new Map(s.availability.map((a) => [a.dayOfWeek, a]));
              return (
                <tr key={s.id} className="border-t border-ink/5">
                  <td className="px-4 py-2 font-medium whitespace-nowrap">{s.lastName}, {s.firstName}</td>
                  {DOW.map((d) => {
                    const a = map.get(d as any);
                    return (
                      <td key={d} className="px-3 py-2 text-center">
                        {a ? <span className="font-mono text-xs">{a.startTime}–{a.endTime}</span> : <span className="text-ink-muted">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
