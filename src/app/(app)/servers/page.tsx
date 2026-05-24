import { prisma } from "@/lib/db";
import ServersTable, { type ServerRow } from "./ServersTable";

export const dynamic = "force-dynamic";

export default async function ServersPage() {
  const rows = await prisma.server.findMany({
    orderBy: [{ seniority: { seniorityRank: "asc" } }, { lastName: "asc" }],
    include: { seniority: true, qualifications: { include: { qualification: true } } },
  });
  const servers: ServerRow[] = rows.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    employeeId: s.employeeId,
    email: s.email,
    phone: s.phone,
    classification: s.classification,
    hireDate: s.hireDate.toISOString(),
    status: s.status,
    seniority: s.seniority
      ? {
          seniorityRank: s.seniority.seniorityRank,
          yearsOfService: s.seniority.yearsOfService,
          seniorityScore: s.seniority.seniorityScore,
        }
      : null,
    qualifications: s.qualifications.map((q) => ({
      id: q.id,
      qualification: { code: q.qualification.code, name: q.qualification.name },
    })),
  }));
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl">Server Database</h1>
          <p className="text-ink-muted">
            Banquet staff roster, sorted by seniority. Click the pencil icon on
            any row to edit name, employee ID, or hire date. Hire-date changes
            recompute seniority for the whole roster in one transaction.
          </p>
        </div>
        <a href="/api/export?kind=servers" className="btn-outline">Export CSV</a>
      </div>
      <ServersTable servers={servers} />
    </div>
  );
}
