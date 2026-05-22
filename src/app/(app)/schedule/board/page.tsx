import { prisma } from "@/lib/db";
import ScheduleBoard from "./board";
import { startOfOperationalWeek, endOfOperationalWeek } from "@/lib/week-config";

export const dynamic = "force-dynamic";

export default async function ScheduleBoardPage({
  searchParams,
}: {
  searchParams: { id?: string; week?: string };
}) {
  // Three ways to resolve the active schedule:
  //   1. ?id=<scheduleId>  → load that schedule directly
  //   2. ?week=YYYY-MM-DD  → load the schedule whose week contains that date
  //   3. neither           → most recent schedule
  let schedule = null as Awaited<ReturnType<typeof prisma.schedule.findFirst>>;
  if (searchParams.id) {
    schedule = await prisma.schedule.findUnique({ where: { id: searchParams.id } });
  } else if (searchParams.week) {
    const target = new Date(searchParams.week);
    if (!isNaN(target.getTime())) {
      const ws = startOfOperationalWeek(target);
      const we = endOfOperationalWeek(target);
      schedule = await prisma.schedule.findFirst({
        where: { weekStart: { gte: ws, lte: we } },
        orderBy: { weekStart: "desc" },
      });
    }
  }
  if (!schedule) {
    schedule = await prisma.schedule.findFirst({ orderBy: { weekStart: "desc" } });
  }

  // Sibling schedules for the week-picker dropdown — all known weeks, newest first.
  const siblingSchedules = await prisma.schedule.findMany({
    orderBy: { weekStart: "desc" },
    select: { id: true, name: true, weekStart: true, weekEnd: true, status: true },
    take: 52,
  });

  if (!schedule) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-display mb-2">No schedule found</h1>
        <p className="text-ink-muted">Generate one first from the Generate Schedule page.</p>
      </div>
    );
  }

  const [shifts, servers] = await Promise.all([
    prisma.shift.findMany({
      where: { scheduleId: schedule.id },
      orderBy: [{ date: "asc" }, { startsAt: "asc" }],
      include: {
        requirements: { include: { role: true } },
        assignments: { include: { server: true } },
        event: {
          include: {
            beo: {
              select: {
                id: true,
                postAs: true,
                expectedGuests: true,
                manager: { select: { id: true, name: true } },
                location: { select: { code: true, name: true } },
                room: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.server.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ seniority: { seniorityRank: "asc" } }],
      include: { seniority: true, qualifications: { include: { qualification: true } } },
    }),
  ]);

  // Serialize Date instances for the client island.
  const serialized = JSON.parse(JSON.stringify({ schedule, shifts, servers, siblingSchedules }));
  return <ScheduleBoard data={serialized} />;
}
