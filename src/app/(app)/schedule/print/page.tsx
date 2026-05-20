import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/utils";
import PrintControls from "./PrintControls";
import PrintSchedule from "./PrintSchedule";

export const dynamic = "force-dynamic";

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
        requirements: { include: { role: true } },
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

  const safeSchedule = {
    id: schedule.id,
    name: schedule.name,
    weekStart: schedule.weekStart.toISOString(),
    weekEnd: schedule.weekEnd.toISOString(),
    revisionDate: schedule.revisionDate ? schedule.revisionDate.toISOString() : null,
    status: schedule.status,
    notes: schedule.notes,
  };
  const safeShifts = shifts.map((s) => ({
    id: s.id,
    date: s.date.toISOString(),
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    locationCode: s.locationCode,
    roomCode: s.roomCode,
    label: s.label,
    statusCode: s.statusCode,
    requirements: s.requirements.map((r) => ({ roleCode: r.role.code, count: r.count })),
    assignments: s.assignments.map((a) => ({
      id: a.id,
      serverId: a.serverId,
      roleCode: a.roleCode,
      server: { id: a.server.id, firstName: a.server.firstName, lastName: a.server.lastName },
    })),
  }));
  const safeServers = servers.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    classification: s.classification,
    seniorityRank: s.seniority?.seniorityRank ?? null,
  }));

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-3xl font-display">Printable Weekly Schedule</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            {fmtDate(schedule.weekStart)} – {fmtDate(schedule.weekEnd)} · {servers.length} servers · {shifts.length} shifts
          </p>
        </div>
        <PrintControls />
      </div>

      <PrintSchedule schedule={safeSchedule} shifts={safeShifts} servers={safeServers} />
    </div>
  );
}
