import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import TimeOffTable, { type TimeOffRow } from "./TimeOffTable";

export const dynamic = "force-dynamic";

export default async function TimeOffPage() {
  const session = await getSession();
  const canDecide = !!session && (session.role === "ADMIN" || session.role === "MANAGER");

  const requests = await prisma.timeOffRequest.findMany({
    orderBy: [{ status: "asc" }, { startDate: "asc" }],
    include: { server: true },
  });

  const rows: TimeOffRow[] = requests.map((r) => ({
    id: r.id,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    reason: r.reason,
    status: r.status,
    server: { firstName: r.server.firstName, lastName: r.server.lastName },
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">Time-Off Requests</h1>
        <p className="text-ink-muted">
          {canDecide
            ? "Approve, deny, or reset pending requests. Decisions are audit-logged."
            : "Read-only view. Contact a manager to update statuses."}
        </p>
      </div>
      <TimeOffTable rows={rows} canDecide={canDecide} />
    </div>
  );
}
