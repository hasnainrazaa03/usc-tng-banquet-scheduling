import { prisma } from "@/lib/db";
import { fmtDate, fmtHireDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SeniorityPage() {
  const records = await prisma.seniorityRecord.findMany({
    orderBy: [{ seniorityScore: "desc" }],
    include: { server: true },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">Seniority Management</h1>
        <p className="text-ink-muted">Higher score = first pick. Seniority is based on tenure (years of service), not age. Manual adjustments allowed for managers.</p>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm table-zebra">
          <thead className="bg-canvas-soft text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-4 py-3 text-left w-12">#</th>
              <th className="px-4 py-3 text-left">Server</th>
              <th className="px-4 py-3 text-left">Hire Date</th>
              <th className="px-4 py-3 text-left">Years of Service</th>
              <th className="px-4 py-3 text-left">Score</th>
              <th className="px-4 py-3 text-left">Manual Adj.</th>
              <th className="px-4 py-3 text-left">Last Reviewed</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={r.id} className="border-t border-ink/5">
                <td className="px-4 py-3 font-mono">{i + 1}</td>
                <td className="px-4 py-3 font-medium">{r.server.lastName}, {r.server.firstName}</td>
                <td className="px-4 py-3">{fmtHireDate(r.server.hireDate)}</td>
                <td className="px-4 py-3">{r.yearsOfService.toFixed(2)}</td>
                <td className="px-4 py-3 font-mono">{r.seniorityScore.toFixed(2)}</td>
                <td className="px-4 py-3">{r.manualAdjustment.toFixed(2)}</td>
                <td className="px-4 py-3">{r.lastReviewed ? fmtDate(r.lastReviewed) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
