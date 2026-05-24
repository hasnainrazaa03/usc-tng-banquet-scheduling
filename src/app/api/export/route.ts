import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { csvResponse, toCsv, type CsvValue } from "@/lib/csv";

export const dynamic = "force-dynamic";

/**
 * GET /api/export?kind=servers|beos|schedule[&scheduleId=<id>]
 *
 * Returns a CSV download. ADMIN / MANAGER only.
 *   • `kind=servers`  — active roster with seniority + classification.
 *   • `kind=beos`     — all BEOs with key fields.
 *   • `kind=schedule` — every shift × assignment row for a given schedule
 *                       (defaults to the most recent schedule).
 */
export async function GET(req: NextRequest) {
  await requireRole(["ADMIN", "MANAGER"]);

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") ?? "servers";

  if (kind === "servers") {
    const servers = await prisma.server.findMany({
      orderBy: [{ seniority: { seniorityRank: "asc" } }, { lastName: "asc" }],
      include: { seniority: true },
    });
    const header = [
      "rank",
      "employeeId",
      "lastName",
      "firstName",
      "classification",
      "employmentType",
      "status",
      "hireDate",
      "homeVenueCodes",
      "presidentialRank",
      "notes",
    ];
    const rows: CsvValue[][] = [header];
    for (const s of servers) {
      rows.push([
        s.seniority?.seniorityRank ?? null,
        s.employeeId ?? null,
        s.lastName,
        s.firstName,
        s.classification,
        s.employmentType,
        s.status,
        s.hireDate,
        (s.homeVenueCodes ?? []).join("|"),
        s.presidentialRank ?? null,
        s.notes ?? null,
      ]);
    }
    return csvResponse(`servers-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  }

  if (kind === "beos") {
    const beos = await prisma.bEO.findMany({
      orderBy: { eventDate: "desc" },
      include: { location: true, room: true, manager: true },
    });
    const header = [
      "beoNumber",
      "bookingId",
      "postAs",
      "account",
      "status",
      "eventDate",
      "startTime",
      "endTime",
      "expectedGuests",
      "locationCode",
      "roomCode",
      "manager",
      "contactName",
      "contactEmail",
      "contactPhone",
    ];
    const rows: CsvValue[][] = [header];
    for (const b of beos) {
      rows.push([
        b.beoNumber ?? null,
        b.bookingId ?? null,
        b.postAs ?? null,
        b.account ?? null,
        b.status,
        b.eventDate,
        b.startTime,
        b.endTime,
        b.expectedGuests ?? null,
        b.location?.code ?? null,
        b.room?.code ?? null,
        b.manager?.name ?? null,
        b.contactName ?? null,
        b.contactEmail ?? null,
        b.contactPhone ?? null,
      ]);
    }
    return csvResponse(`beos-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  }

  if (kind === "schedule") {
    const scheduleId = searchParams.get("scheduleId");
    const schedule = scheduleId
      ? await prisma.schedule.findUnique({ where: { id: scheduleId } })
      : await prisma.schedule.findFirst({ orderBy: { weekStart: "desc" } });
    if (!schedule) {
      return new Response("No schedule found", { status: 404 });
    }
    const shifts = await prisma.shift.findMany({
      where: { scheduleId: schedule.id },
      include: {
        requirements: { include: { role: true } },
        assignments: { include: { server: true } },
      },
      orderBy: [{ date: "asc" }, { startsAt: "asc" }],
    });
    const header = [
      "scheduleName",
      "weekStart",
      "date",
      "startsAt",
      "endsAt",
      "locationCode",
      "roomCode",
      "label",
      "shiftStatus",
      "role",
      "serverLastName",
      "serverFirstName",
      "assignmentId",
      "locked",
      "calledOut",
    ];
    const rows: CsvValue[][] = [header];
    for (const sh of shifts) {
      if (sh.assignments.length === 0) {
        rows.push([
          schedule.name,
          schedule.weekStart,
          sh.date,
          sh.startsAt,
          sh.endsAt,
          sh.locationCode ?? null,
          sh.roomCode ?? null,
          sh.label ?? null,
          sh.statusCode,
          "(open)",
          null,
          null,
          null,
          null,
          null,
        ]);
        continue;
      }
      for (const a of sh.assignments) {
        rows.push([
          schedule.name,
          schedule.weekStart,
          sh.date,
          sh.startsAt,
          sh.endsAt,
          sh.locationCode ?? null,
          sh.roomCode ?? null,
          sh.label ?? null,
          sh.statusCode,
          a.roleCode ?? null,
          a.server.lastName,
          a.server.firstName,
          a.id,
          a.locked,
          a.calledOut,
        ]);
      }
    }
    const stamp = schedule.weekStart.toISOString().slice(0, 10);
    return csvResponse(`schedule-${stamp}.csv`, toCsv(rows));
  }

  return new Response(`Unknown kind: ${kind}`, { status: 400 });
}
