import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { clearUnlockedAssignments, runAutoSchedule } from "@/lib/scheduling-engine";

/**
 * POST /api/schedule/run
 * body: { weekStart: "YYYY-MM-DD", name?: string, clearFirst?: boolean, scheduleId?: string }
 *
 * - If `scheduleId` is given, runs on that schedule.
 * - Otherwise finds-or-creates a schedule for the given week,
 *   and auto-creates shifts from any BEOs in that week that have
 *   no shifts yet.
 */
export async function POST(req: NextRequest) {
  const session = await requireRole(["ADMIN", "MANAGER"]);
  const { weekStart, name, clearFirst, scheduleId } = await req.json();

  let schedule;
  if (scheduleId) {
    schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  } else {
    const start = new Date(weekStart + "T00:00:00");
    const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23,59,59,999);

    schedule = await prisma.schedule.findFirst({ where: { weekStart: start } });
    if (!schedule) {
      schedule = await prisma.schedule.create({
        data: { weekStart: start, weekEnd: end, name: name ?? `Week of ${weekStart}`, createdBy: session.id },
      });
    }

    // Auto-generate shifts from BEOs in this week if none exist yet for the BEO
    const beos = await prisma.bEO.findMany({
      where: { eventDate: { gte: start, lte: end } },
      include: { sections: true, events: true },
    });

    for (const beo of beos) {
      // For each section, ensure a shift exists
      for (const sec of beo.sections) {
        // De-duplicate based on label+startsAt
        const exists = await prisma.shift.findFirst({
          where: {
            scheduleId: schedule.id,
            eventId: beo.events[0]?.id ?? undefined,
            startsAt: sec.startTime,
            label: `${beo.postAs} — ${sec.name}`,
          },
        });
        if (exists) continue;

        // Build requirements from staffingNeeds
        const staffing = (Array.isArray(sec.staffingNeeds) ? sec.staffingNeeds : []) as { roleCode: string; count: number }[];
        const roles = await prisma.role.findMany({ where: { code: { in: staffing.map((s) => s.roleCode) } } });
        const reqCreates = staffing
          .map((s) => {
            const r = roles.find((x) => x.code === s.roleCode);
            return r ? { roleId: r.id, count: s.count } : null;
          })
          .filter(Boolean) as { roleId: string; count: number }[];

        await prisma.shift.create({
          data: {
            scheduleId: schedule.id,
            eventId: beo.events[0]?.id ?? undefined,
            date: new Date(sec.startTime.toISOString().slice(0,10) + "T00:00:00"),
            startsAt: sec.startTime,
            endsAt: sec.endTime,
            locationCode: beo.locationId ? (await prisma.location.findUnique({ where: { id: beo.locationId } }))?.code ?? null : null,
            roomCode: sec.roomCode,
            label: `${beo.postAs} — ${sec.name}`,
            requirements: { create: reqCreates },
          },
        });
      }
    }
  }

  if (clearFirst) await clearUnlockedAssignments(schedule.id);
  const result = await runAutoSchedule({ scheduleId: schedule.id });

  await prisma.auditLog.create({
    data: {
      userId: session.id, action: "SCHEDULE_RUN", entity: "Schedule", entityId: schedule.id,
      message: `Auto-scheduler: ${result.filled} filled, ${result.unfilled} unfilled`,
      after: result as unknown as object,
    },
  });

  return NextResponse.json({ scheduleId: schedule.id, ...result });
}
