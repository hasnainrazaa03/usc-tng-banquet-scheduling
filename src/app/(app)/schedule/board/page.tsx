import { prisma } from "@/lib/db";
import ScheduleBoard from "./board";
import { startOfOperationalWeek, endOfOperationalWeek, parseLocalDate } from "@/lib/week-config";
import { ensureWeeklySchedule, syncBeoShifts } from "@/lib/beo-sync";

export const dynamic = "force-dynamic";

export default async function ScheduleBoardPage({
  searchParams,
}: {
  searchParams: { id?: string; week?: string };
}) {
  // Resolve which operational week the user is looking at.
  //
  //   1. ?id=<scheduleId>  → load that schedule directly (anchored to its weekStart)
  //   2. ?week=YYYY-MM-DD  → anchor to the Thursday of that week
  //   3. neither           → anchor to the current operational week
  //
  // Phase 7 change: we no longer fall back to "the most recent schedule" or
  // bail out with "No schedule found". Instead the board makes the requested
  // week real on demand — it materialises a Schedule row for it (Thursday
  // 00:00 → Wednesday 23:59) and then syncs any BEOs whose eventDate lands
  // in that window into Shifts. This means every week of the year is
  // navigable and every BEO already in the DB shows up automatically.
  //
  // Phase 9 bugfix: parse `?week` via `parseLocalDate` so a bare YYYY-MM-DD
  // is anchored in local time. `new Date("2026-05-21")` was being read as
  // UTC midnight which, in PDT, became the previous calendar day — that's
  // why Today/Prev/Next previously jumped to the wrong operational week.
  let anchorDate: Date = startOfOperationalWeek(new Date());
  let schedule = null as Awaited<ReturnType<typeof prisma.schedule.findFirst>>;

  if (searchParams.id) {
    schedule = await prisma.schedule.findUnique({ where: { id: searchParams.id } });
    if (schedule) anchorDate = startOfOperationalWeek(schedule.weekStart);
  }

  if (!schedule) {
    if (searchParams.week) {
      const parsed = parseLocalDate(searchParams.week);
      if (!isNaN(parsed.getTime())) {
        anchorDate = startOfOperationalWeek(parsed);
      }
    }
    schedule = await ensureWeeklySchedule(anchorDate);
  }

  const ws = startOfOperationalWeek(schedule.weekStart);
  const we = endOfOperationalWeek(schedule.weekStart);

  // Sync every BEO that lands in this operational week so the board is
  // BEO-driven: if it's in the DB, it appears on the board. `syncBeoShifts`
  // is idempotent — already-synced BEOs are no-ops.
  const beosInWeek = await prisma.bEO.findMany({
    where: { eventDate: { gte: ws, lte: we } },
    select: { id: true },
  });
  for (const b of beosInWeek) {
    try {
      await syncBeoShifts(b.id);
    } catch (err) {
      console.error(`[board] syncBeoShifts(${b.id}) failed`, err);
    }
  }

  // Sibling schedules for the week-picker dropdown — every known schedule,
  // newest first, so jumps from the picker still work for arbitrary weeks.
  const siblingSchedules = await prisma.schedule.findMany({
    orderBy: { weekStart: "desc" },
    select: { id: true, name: true, weekStart: true, weekEnd: true, status: true },
    take: 104,
  });

  // CRITICAL: every Shift returned is scoped to `schedule.id`, which itself
  // is anchored to the requested operational week. There is no cross-week
  // bleed at the query level.
  const [shifts, servers, managers] = await Promise.all([
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
    prisma.user.findMany({
      where: { active: true, role: { in: ["MANAGER", "ADMIN"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);

  // Serialize Date instances for the client island.
  const serialized = JSON.parse(
    JSON.stringify({ schedule, shifts, servers, managers, siblingSchedules }),
  );
  // Force a full remount whenever the user navigates to a different
  // operational week. Without `key`, `useState(data.shifts)` would keep
  // the previous week's shifts on screen even though the RSC fetched
  // fresh ones — exactly the "BEOs don't change when the week changes"
  // bug reported in Phase 9.
  return <ScheduleBoard key={schedule.id} data={serialized} />;
}
