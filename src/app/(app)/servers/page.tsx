import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtHireDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ServersPage() {
  const servers = await prisma.server.findMany({
    orderBy: [{ seniority: { seniorityRank: "asc" } }, { lastName: "asc" }],
    include: { seniority: true, qualifications: { include: { qualification: true } } },
  });
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl">Server Database</h1>
          <p className="text-ink-muted">Banquet staff roster, sorted by seniority.</p>
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-canvas-soft text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-4 py-3 text-left w-16">Rank</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Emp. ID</th>
              <th className="px-4 py-3 text-left">Classification</th>
              <th className="px-4 py-3 text-left">Hire Date</th>
              <th className="px-4 py-3 text-left">Years</th>
              <th className="px-4 py-3 text-left">Score</th>
              <th className="px-4 py-3 text-left">Qualifications</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((s) => (
              <tr key={s.id} className="border-t border-ink/5 hover:bg-canvas-soft/50">
                <td className="px-4 py-3 font-mono">{s.seniority?.seniorityRank ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{s.lastName}, {s.firstName}</div>
                  <div className="text-xs text-ink-muted">{s.email ?? "—"} · {s.phone ?? "—"}</div>
                </td>
                <td className="px-4 py-3 font-mono">{s.employeeId}</td>
                <td className="px-4 py-3"><span className="pill bg-ink/5">{s.classification.replaceAll("_"," ")}</span></td>
                <td className="px-4 py-3">{fmtHireDate(s.hireDate)}</td>
                <td className="px-4 py-3">{s.seniority?.yearsOfService.toFixed(1) ?? "—"}</td>
                <td className="px-4 py-3 font-mono">{s.seniority?.seniorityScore.toFixed(1) ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {s.qualifications.map((q) => (
                      <span key={q.id} className="pill bg-gold-100 text-gold-900 border border-gold-200">{q.qualification.code}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`pill ${s.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-ink/10"}`}>{s.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
