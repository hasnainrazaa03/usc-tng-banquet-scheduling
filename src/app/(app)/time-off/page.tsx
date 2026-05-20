import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TimeOffPage() {
  const requests = await prisma.timeOffRequest.findMany({
    orderBy: { startDate: "asc" },
    include: { server: true },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">Time-Off Requests</h1>
        <p className="text-ink-muted">All pending, approved, denied, and cancelled requests.</p>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm table-zebra">
          <thead className="bg-canvas-soft text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-4 py-3 text-left">Server</th>
              <th className="px-4 py-3 text-left">Start</th>
              <th className="px-4 py-3 text-left">End</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-t border-ink/5">
                <td className="px-4 py-3 font-medium">{r.server.lastName}, {r.server.firstName}</td>
                <td className="px-4 py-3">{fmtDate(r.startDate)}</td>
                <td className="px-4 py-3">{fmtDate(r.endDate)}</td>
                <td className="px-4 py-3">{r.reason ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`pill ${
                    r.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" :
                    r.status === "PENDING"  ? "bg-amber-100 text-amber-800" :
                    r.status === "DENIED"   ? "bg-red-100 text-red-800" :
                    "bg-ink/10"
                  }`}>{r.status}</span>
                </td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-muted">No requests.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
