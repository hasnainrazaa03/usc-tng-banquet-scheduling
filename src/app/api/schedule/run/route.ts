import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { clearUnlockedAssignments, runAutoSchedule } from "@/lib/scheduling-engine";
import { ensureWeeklySchedule, syncBeoShifts } from "@/lib/beo-sync";
import { startOfOperationalWeek, endOfOperationalWeek } from "@/lib/week-config";

/**
 * POST /api/schedule/run
 * body: { weekStart?: "YYYY-MM-DD", name?: string, clearFirst?: boolean, scheduleId?: string }
 *
 * - If `scheduleId` is given, runs auto-scheduling on that schedule.
 * - Otherwise the date in `weekStart` is normalised to the operational-week
 *   start (Thursday) and a Schedule is found-or-created. BEOs whose
 *   `eventDate` falls inside that week are synced into Shifts before the
 *   auto-scheduler runs.
 *
 * ALWAYS returns JSON (success or error). Never throws past the handler so
 * the frontend `await res.json()` cannot blow up on an empty body.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "MANAGER"]);
    const body = await req.json().catch(() => ({}));
    const { weekStart, name, clearFirst, scheduleId } = body as {
      weekStart?: string;
      name?: string;
      clearFirst?: boolean;
      scheduleId?: string;
    };

    let schedule;
    if (scheduleId) {
      schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
      if (!schedule) {
        return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
      }
    } else {
      if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
        return NextResponse.json(
          { error: "weekStart must be YYYY-MM-DD or a scheduleId must be provided" },
          { status: 400 },
        );
      }
      const picked = new Date(weekStart + "T00:00:00");
      if (Number.isNaN(picked.getTime())) {
        return NextResponse.json({ error: "Invalid weekStart date" }, { status: 400 });
      }

      // Operational-week normalisation: the user may pick any day in the
      // week; we always anchor on Thursday 00:00 → following Wednesday 23:59.
      const start = startOfOperationalWeek(picked);
      const end = endOfOperationalWeek(picked);
      schedule = await ensureWeeklySchedule(picked, session.id);
      if (name && schedule.name !== name) {
        schedule = await prisma.schedule.update({
          where: { id: schedule.id },
          data: { name },
        });
      }

      // Sync every BEO that lands in this operational week.
      const beos = await prisma.bEO.findMany({
        where: { eventDate: { gte: start, lte: end } },
        select: { id: true },
      });
      for (const b of beos) {
        try {
          await syncBeoShifts(b.id, session.id);
        } catch (e) {
          // Continue with the rest of the week even if one BEO fails to sync.
          console.error("[schedule/run] BEO sync failed", b.id, e);
        }
      }
    }

    if (clearFirst) await clearUnlockedAssignments(schedule.id);
    const result = await runAutoSchedule({ scheduleId: schedule.id });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "SCHEDULE_RUN",
        entity: "Schedule",
        entityId: schedule.id,
        message: `Auto-scheduler: ${result.filled} filled, ${result.unfilled} unfilled`,
        after: result as unknown as object,
      },
    });

    return NextResponse.json({ scheduleId: schedule.id, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[schedule/run] failed", e);
    if (msg === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: msg || "Internal error" }, { status: 500 });
  }
}
