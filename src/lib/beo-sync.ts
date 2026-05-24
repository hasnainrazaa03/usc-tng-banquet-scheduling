/**
 * BEO → Schedule synchronisation.
 *
 * One source of truth for "given a BEO, make sure the operational-week
 * Schedule exists and has the right Event + Shift(s) + role requirements".
 *
 * Called from:
 *   - POST /api/beos          (immediately after a BEO is created)
 *   - POST /api/schedule/run  (bulk sync at week-generation time)
 *
 * Idempotent: re-running for the same BEO will not duplicate shifts.
 */

import { prisma } from "./db";
import { startOfOperationalWeek, endOfOperationalWeek } from "./week-config";

/**
 * Window padding around the catered event window. Servers typically need to
 * arrive before the event starts and stay after to break down.
 */
const PRE_EVENT_MINUTES = 60;
const POST_EVENT_MINUTES = 30;

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

/**
 * Ensure a Schedule exists for the operational week that contains `date`.
 * Returns the Schedule row.
 */
export async function ensureWeeklySchedule(date: Date, createdBy?: string) {
  const weekStart = startOfOperationalWeek(date);
  const weekEnd = endOfOperationalWeek(date);

  const existing = await prisma.schedule.findFirst({ where: { weekStart } });
  if (existing) return existing;

  const ymd = weekStart.toISOString().slice(0, 10);
  return prisma.schedule.create({
    data: {
      weekStart,
      weekEnd,
      name: `Week of ${ymd}`,
      createdBy: createdBy ?? null,
    },
  });
}

/**
 * Make sure the given BEO has an Event row + one Shift per BEOSection in
 * its operational-week Schedule, with role requirements derived from the
 * section's `staffingNeeds` JSON.
 *
 * Safe to call repeatedly — existing shifts (matched by scheduleId +
 * startsAt + label) are left alone.
 */
export async function syncBeoShifts(beoId: string, createdBy?: string) {
  const beo = await prisma.bEO.findUnique({
    where: { id: beoId },
    include: {
      sections: true,
      events: true,
      location: true,
      room: true,
    },
  });
  if (!beo) return { created: 0, skipped: 0, error: "BEO not found" };

  const schedule = await ensureWeeklySchedule(beo.eventDate, createdBy);

  // Make sure there is exactly one Event row tied to this BEO so the board
  // can group shifts by event and label cards with the event name.
  let event = beo.events[0];
  if (!event) {
    event = await prisma.event.create({
      data: {
        beoId: beo.id,
        roomId: beo.roomId,
        name: beo.postAs,
        startsAt: beo.startTime,
        endsAt: beo.endTime,
        guests: beo.expectedGuests,
      },
    });
  }

  let created = 0;
  let skipped = 0;

  // If this BEO already has at least one Shift in the target schedule
  // (typically because the seed or a prior sync materialised it directly),
  // do NOT synthesize a default "Main Service" section on top — that path
  // is what produced duplicate cards on the board for the same BEO/day.
  if (!beo.sections.length) {
    const existingForBeo = await prisma.shift.count({
      where: { scheduleId: schedule.id, eventId: { in: beo.events.map((e) => e.id) } },
    });
    if (existingForBeo > 0) {
      return { scheduleId: schedule.id, eventId: event.id, created: 0, skipped: existingForBeo };
    }
  }

  // Resolve role ids once per call.
  const sections = beo.sections.length
    ? beo.sections
    : [
        // Synthesize a default "Main Service" section if none exist yet.
        {
          id: "synthetic",
          beoId: beo.id,
          name: "Main Service",
          functionType: null,
          startTime: beo.startTime,
          endTime: beo.endTime,
          roomCode: beo.room?.code ?? null,
          setupType: null,
          guests: beo.expectedGuests,
          notes: null,
          staffingNeeds: [
            { roleCode: "SVR", count: Math.max(4, Math.ceil((beo.expectedGuests ?? 0) / 25)) },
          ] as unknown as object,
        },
      ];

  for (const sec of sections) {
    const label = `${beo.postAs} — ${sec.name}`;
    const exists = await prisma.shift.findFirst({
      where: {
        scheduleId: schedule.id,
        eventId: event.id,
        startsAt: sec.startTime,
        label,
      },
    });
    if (exists) {
      skipped++;
      continue;
    }

    const staffing = (Array.isArray(sec.staffingNeeds) ? sec.staffingNeeds : []) as {
      roleCode: string;
      count: number;
    }[];
    const roles = await prisma.role.findMany({
      where: { code: { in: staffing.map((s) => s.roleCode) } },
    });
    const reqCreates = staffing
      .map((s) => {
        const r = roles.find((x) => x.code === s.roleCode);
        return r ? { roleId: r.id, count: s.count } : null;
      })
      .filter(Boolean) as { roleId: string; count: number }[];

    // Calendar day key (local). We deliberately use the section's local Y-M-D
    // rather than UTC slice to avoid an off-by-one in negative timezones.
    const day = new Date(sec.startTime);
    day.setHours(0, 0, 0, 0);

    await prisma.shift.create({
      data: {
        scheduleId: schedule.id,
        eventId: event.id,
        date: day,
        startsAt: addMinutes(sec.startTime, -PRE_EVENT_MINUTES),
        endsAt: addMinutes(sec.endTime, POST_EVENT_MINUTES),
        locationCode: beo.location?.code ?? null,
        roomCode: sec.roomCode ?? beo.room?.code ?? null,
        label,
        requirements: { create: reqCreates },
      },
    });
    created++;
  }

  return { scheduleId: schedule.id, eventId: event.id, created, skipped };
}
