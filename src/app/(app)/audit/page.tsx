import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: true },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">Audit Log</h1>
        <p className="text-ink-muted">Last 200 changes across the system.</p>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-canvas-soft text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-4 py-3 text-left">When</th>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Entity</th>
              <th className="px-4 py-3 text-left">Message</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-ink/5">
                <td className="px-4 py-2 whitespace-nowrap text-xs text-ink-muted">{l.createdAt.toLocaleString()}</td>
                <td className="px-4 py-2">{l.user?.name ?? "system"}</td>
                <td className="px-4 py-2"><span className="pill bg-cardinal/10 text-cardinal">{l.action}</span></td>
                <td className="px-4 py-2">{l.entity}</td>
                <td className="px-4 py-2 text-xs">{l.message ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-muted">No activity yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
