import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/schedule/replace
 * body: { assignmentId: string, limit?: number }
 *
 * Suggests up to `limit` replacement servers for the called-out (or
 * to-be-replaced) assignment. Does NOT mutate any data — the manager
 * confirms a replacement explicitly through the normal /api/schedule/assign
 * endpoint. This keeps the workflow manager-controlled first,
 * AI-assisted second.
 *
 * Returns: { candidates: [{ serverId, name, seniorityRank, score, reasons }] }
 */
const DAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

function hoursBetween(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) / 36e5;
}
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const body = await req.json().catch(() => ({}));
    const { assignmentId, limit } = body as { assignmentId?: string; limit?: number };
    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
    }

    const a = await prisma.shiftAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        shift: {
          include: {
            requirements: { include: { role: { include: { qualificationsRequired: true } } } },
            assignments: true,
          },
        },
      },
    });
    if (!a) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    const shift = a.shift;
    const role = shift.requirements.find((r) => r.role.code === a.roleCode)?.role ?? null;

    const allServers = await prisma.server.findMany({
      where: { status: "ACTIVE", id: { not: a.serverId } },
      include: {
        seniority: true,
        qualifications: true,
        availability: true,
        timeOff: true,
        assignments: { include: { shift: true } },
      },
    });

    const dow = DAY[shift.startsAt.getDay()];
    const cap = 40;
    const minRest = 10;

    const ranked: { serverId: string; name: string; seniorityRank: number | null; score: number; reasons: string[] }[] = [];

    for (const s of allServers) {
      const reasons: string[] = [];

      // Already actively assigned to this shift?
      const taken = shift.assignments.some((x) => x.serverId === s.id && !x.calledOut);
      if (taken) continue;

      // Qualifications.
      if (role) {
        const required = role.qualificationsRequired.map((q) => q.qualificationId);
        const hasAll = required.every((qid) => s.qualifications.some((sq) => sq.qualificationId === qid));
        if (!hasAll) continue;
      }

      // Availability.
      const winOk = s.availability.some((av) => {
        if (av.dayOfWeek !== dow) return false;
        const [sh, sm] = av.startTime.split(":").map(Number);
        const [eh, em] = av.endTime.split(":").map(Number);
        const winStart = new Date(shift.startsAt); winStart.setHours(sh, sm, 0, 0);
        const winEnd = new Date(shift.startsAt); winEnd.setHours(eh, em, 0, 0);
        return shift.startsAt >= winStart && shift.endsAt <= winEnd;
      });
      if (!winOk) continue;

      // Approved time off.
      if (s.timeOff.some((t) => t.status === "APPROVED" && overlaps(t.startDate, t.endDate, shift.startsAt, shift.endsAt))) {
        continue;
      }

      const activeOwn = s.assignments.filter((x) => !x.calledOut);

      // Overlap with another shift.
      if (activeOwn.some((x) => x.shift.scheduleId === shift.scheduleId && overlaps(x.shift.startsAt, x.shift.endsAt, shift.startsAt, shift.endsAt))) {
        continue;
      }

      // Weekly cap.
      const weekHours = activeOwn
        .filter((x) => x.shift.scheduleId === shift.scheduleId)
        .reduce((sum, x) => sum + hoursBetween(x.shift.startsAt, x.shift.endsAt), 0);
      const shiftHours = hoursBetween(shift.startsAt, shift.endsAt);
      if (weekHours + shiftHours > cap) continue;

      // Min rest.
      if (
        activeOwn.some(
          (x) =>
            x.shift.scheduleId === shift.scheduleId &&
            hoursBetween(x.shift.endsAt, shift.startsAt) < minRest &&
            hoursBetween(shift.endsAt, x.shift.startsAt) < minRest,
        )
      ) {
        continue;
      }

      const seniority = s.seniority?.seniorityScore ?? 0;
      let score = seniority * 100 - (weekHours / 40) * 10;
      reasons.push(`seniority ${seniority.toFixed(1)}y`);
      if (shift.locationCode && s.preferredLocations.includes(shift.locationCode)) {
        score += 3;
        reasons.push(`prefers ${shift.locationCode}`);
      }
      ranked.push({
        serverId: s.id,
        name: `${s.firstName} ${s.lastName}`,
        seniorityRank: s.seniority?.seniorityRank ?? null,
        score,
        reasons,
      });
    }

    ranked.sort((x, y) => y.score - x.score || x.name.localeCompare(y.name));
    return NextResponse.json({
      shiftId: shift.id,
      roleCode: a.roleCode,
      candidates: ranked.slice(0, Math.min(Math.max(1, limit ?? 5), 20)),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Internal error" }, { status: 500 });
  }
}
