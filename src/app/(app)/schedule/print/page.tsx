import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/utils";
import PrintControls from "./PrintControls";
import PrintSchedule from "./PrintSchedule";

export const dynamic = "force-dynamic";

export default async function PrintSchedulePage({
  searchParams,
}: {
  searchParams: { id?: string; vg?: string };
}) {
  const schedule = searchParams.id
    ? await prisma.schedule.findUnique({ where: { id: searchParams.id } })
    : await prisma.schedule.findFirst({ orderBy: { weekStart: "desc" } });

  if (!schedule) {
    return <div className="card p-8 text-center text-ink-muted">No schedule.</div>;
  }

  // Venue-group filter (Phase 13). `?vg=UPC` etc. limits the printed grid to
  // shifts whose locationCode belongs to that group. We resolve the group's
  // location codes once and pass them as a `locationCode IN (…)` predicate.
  const venueGroups = await prisma.venueGroup.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { locations: { select: { code: true } } },
  });
  const vgCode = searchParams.vg && searchParams.vg !== "ALL" ? searchParams.vg : null;
  const activeGroup = vgCode ? venueGroups.find((g) => g.code === vgCode) : null;
  const locationCodeFilter = activeGroup
    ? activeGroup.locations.map((l) => l.code)
    : null;

  const [shifts, servers] = await Promise.all([
    prisma.shift.findMany({
      where: {
        scheduleId: schedule.id,
        ...(locationCodeFilter ? { locationCode: { in: locationCodeFilter } } : {}),
      },
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
            {activeGroup && (
              <>
                {" "}· <span className="font-semibold text-ink">Filter: {activeGroup.name}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form method="get" className="flex items-center gap-2">
            {searchParams.id && <input type="hidden" name="id" value={searchParams.id} />}
            <label className="text-xs text-ink-muted">Venue group</label>
            <select
              name="vg"
              defaultValue={vgCode ?? "ALL"}
              className="text-sm rounded-md border border-ink/15 px-2 py-1 bg-white"
            >
              <option value="ALL">All groups</option>
              {venueGroups.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.shortName ?? g.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="text-xs font-semibold rounded-md border border-ink/15 px-2 py-1 hover:bg-canvas-soft"
            >
              Apply
            </button>
          </form>
          <PrintControls />
        </div>
      </div>

      <PrintSchedule schedule={safeSchedule} shifts={safeShifts} servers={safeServers} />
    </div>
  );
}
