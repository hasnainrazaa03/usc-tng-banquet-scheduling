/**
 * USC Private Events & Conferences — Scheduling Engine
 * ─────────────────────────────────────────────────────────────
 * Deterministic rule-based engine with explainable selection.
 *
 * Selection order, per role-requirement:
 *   1. Hard filters: active, qualified, available, no time-off,
 *                    no double-booking, hour limits, min rest.
 *   2. Seniority preference (higher score wins).
 *   3. Fairness tie-breakers (lower scheduled hours in window wins).
 *   4. Preference matches (location / shift code).
 *   5. Stable name tiebreaker.
 *
 * Every assignment records a human-readable `reason` so the
 * AI explanation surface can show *why* a server was selected.
 */

import { prisma } from "./db";
import type {
  Shift,
  ShiftRequirement,
  Server,
  Role,
  Qualification,
  ServerQualification,
  SeniorityRecord,
  Availability,
  TimeOffRequest,
  ShiftAssignment,
} from "@prisma/client";

type EngineServer = Server & {
  seniority: SeniorityRecord | null;
  qualifications: (ServerQualification & { qualification: Qualification })[];
  availability: Availability[];
  timeOff: TimeOffRequest[];
  assignments: (ShiftAssignment & { shift: Shift })[];
};

type EngineShift = Shift & {
  requirements: (ShiftRequirement & { role: Role & { qualificationsRequired: { qualificationId: string }[] } })[];
  assignments: ShiftAssignment[];
};

export type EngineOptions = {
  scheduleId: string;
  /** Re-assign already-filled (non-locked) shifts? Default false. */
  reassignUnlocked?: boolean;
  /** Window in days for fairness balance. Defaults to 28. */
  fairnessWindowDays?: number;
  /** Max consecutive days a server can be scheduled. Defaults to 6. */
  maxConsecutiveDays?: number;
  /** Min rest hours between shifts. Defaults to 10. */
  minRestHours?: number;
  /** Soft cap on weekly hours per server. Defaults to 40. */
  weeklyHourCap?: number;
};

export type EngineDecision = {
  shiftId: string;
  roleId: string;
  serverId: string | null;
  reason: string;
  rejected: { serverId: string; reason: string }[];
};

export type EngineResult = {
  filled: number;
  unfilled: number;
  decisions: EngineDecision[];
};

const DAY = ["SUN","MON","TUE","WED","THU","FRI","SAT"] as const;

function dayOfWeekCode(d: Date) {
  // Native Sun=0..Sat=6 lookup. Operational week ordering lives in week-config.ts;
  // the scheduling engine only needs the date's calendar weekday for availability
  // and time-off filtering, so we stick with the native enum mapping here.
  return DAY[d.getDay()];
}
function hoursBetween(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) / 36e5;
}
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}
function inAvailability(server: EngineServer, start: Date, end: Date) {
  const dow = dayOfWeekCode(start) as Availability["dayOfWeek"];
  return server.availability.some((a) => {
    if (a.dayOfWeek !== dow) return false;
    const [sh, sm] = a.startTime.split(":").map(Number);
    const [eh, em] = a.endTime.split(":").map(Number);
    const winStart = new Date(start); winStart.setHours(sh, sm, 0, 0);
    const winEnd   = new Date(start); winEnd.setHours(eh, em, 0, 0);
    return start >= winStart && end <= winEnd;
  });
}
function inTimeOff(server: EngineServer, start: Date, end: Date) {
  return server.timeOff.some(
    (t) => t.status === "APPROVED" && overlaps(t.startDate, t.endDate, start, end)
  );
}

export async function runAutoSchedule(opts: EngineOptions): Promise<EngineResult> {
  const fairnessWindowDays = opts.fairnessWindowDays ?? 28;
  const minRestHours = opts.minRestHours ?? 10;
  const weeklyCap = opts.weeklyHourCap ?? 40;
  const maxConsecutive = opts.maxConsecutiveDays ?? 6;

  const schedule = await prisma.schedule.findUnique({
    where: { id: opts.scheduleId },
    include: {
      shifts: {
        include: {
          requirements: { include: { role: { include: { qualificationsRequired: true } } } },
          assignments: true,
        },
        orderBy: [{ date: "asc" }, { startsAt: "asc" }],
      },
    },
  });
  if (!schedule) throw new Error("Schedule not found");

  const allServers = await prisma.server.findMany({
    where: { status: "ACTIVE" },
    include: {
      seniority: true,
      qualifications: { include: { qualification: true } },
      availability: true,
      timeOff: true,
      assignments: { include: { shift: true } },
    },
  });

  const decisions: EngineDecision[] = [];
  // Track in-memory weekly hours for each server (live)
  const liveHours = new Map<string, number>();
  for (const s of allServers) {
    let total = 0;
    for (const a of s.assignments) {
      if (a.shift.scheduleId === schedule.id) total += hoursBetween(a.shift.startsAt, a.shift.endsAt);
    }
    liveHours.set(s.id, total);
  }

  let filled = 0;
  let unfilled = 0;

  // Iterate critical shifts first (more requirements, larger events)
  const shifts = [...(schedule.shifts as EngineShift[])].sort(
    (a, b) => (b.requirements.reduce((n, r) => n + r.count, 0)) -
              (a.requirements.reduce((n, r) => n + r.count, 0))
  );

  for (const shift of shifts) {
    if (shift.statusCode !== "NONE") continue; // OFF/VAC/etc don't get assigned

    for (const req of shift.requirements) {
      const currentForRole = shift.assignments.filter((a) => a.roleCode === req.role.code).length;
      const neededRaw = req.count - currentForRole;
      if (neededRaw <= 0) continue;

      for (let n = 0; n < neededRaw; n++) {
        // Score candidates
        const rejected: { serverId: string; reason: string }[] = [];
        const candidates: { server: EngineServer; score: number; reasonBits: string[] }[] = [];

        for (const s of allServers as EngineServer[]) {
          // Already on this shift?
          const taken = shift.assignments.some((a) => a.serverId === s.id);
          if (taken) { rejected.push({ serverId: s.id, reason: "Already assigned to this shift" }); continue; }

          // Qualifications
          const requiredQuals = req.role.qualificationsRequired.map((q) => q.qualificationId);
          const hasAll = requiredQuals.every((qid) => s.qualifications.some((sq) => sq.qualificationId === qid));
          if (!hasAll) { rejected.push({ serverId: s.id, reason: `Missing qualification for role ${req.role.code}` }); continue; }

          // Availability
          if (!inAvailability(s, shift.startsAt, shift.endsAt)) {
            rejected.push({ serverId: s.id, reason: "Outside stated availability" }); continue;
          }
          // Time off
          if (inTimeOff(s, shift.startsAt, shift.endsAt)) {
            rejected.push({ serverId: s.id, reason: "On approved time off" }); continue;
          }

          // Double-booking + min rest
          const conflict = s.assignments.find((a) =>
            a.shift.scheduleId === schedule.id &&
            overlaps(a.shift.startsAt, a.shift.endsAt, shift.startsAt, shift.endsAt)
          );
          if (conflict) { rejected.push({ serverId: s.id, reason: "Double-booked on overlapping shift" }); continue; }

          const restViol = s.assignments.find((a) =>
            a.shift.scheduleId === schedule.id &&
            hoursBetween(a.shift.endsAt, shift.startsAt) < minRestHours &&
            hoursBetween(shift.endsAt, a.shift.startsAt) < minRestHours
          );
          if (restViol) { rejected.push({ serverId: s.id, reason: `Less than ${minRestHours}h rest between shifts` }); continue; }

          // Weekly cap
          const shiftHours = hoursBetween(shift.startsAt, shift.endsAt);
          const projected = (liveHours.get(s.id) ?? 0) + shiftHours;
          if (projected > weeklyCap) { rejected.push({ serverId: s.id, reason: `Exceeds weekly cap ${weeklyCap}h` }); continue; }

          // Consecutive days
          // (Simple check: count distinct dates in this schedule already assigned)
          const days = new Set(
            s.assignments
              .filter((a) => a.shift.scheduleId === schedule.id)
              .map((a) => a.shift.date.toISOString().slice(0,10))
          );
          days.add(shift.date.toISOString().slice(0,10));
          if (days.size > maxConsecutive) {
            rejected.push({ serverId: s.id, reason: `Exceeds ${maxConsecutive}-consecutive-day rule` }); continue;
          }

          // Score: seniority primary, fairness secondary, preferences tertiary
          const seniority = s.seniority?.seniorityScore ?? 0;
          const hoursPenalty = (liveHours.get(s.id) ?? 0) / 40; // 0..1
          let score = seniority * 100 - hoursPenalty * 10;
          const reasonBits: string[] = [];

          reasonBits.push(`seniority ${seniority.toFixed(1)}y`);

          if (shift.locationCode && s.preferredLocations.includes(shift.locationCode)) {
            score += 3;
            reasonBits.push(`prefers ${shift.locationCode}`);
          }
          if (s.classification === "LEAD_BANQUET_CAPTAIN" && req.role.code === "CAP") {
            score += 5;
            reasonBits.push("lead captain");
          }

          candidates.push({ server: s, score, reasonBits });
        }

        // Tie-breakers: name asc to keep stable
        candidates.sort((a, b) =>
          b.score - a.score ||
          a.server.lastName.localeCompare(b.server.lastName) ||
          a.server.firstName.localeCompare(b.server.firstName)
        );

        const chosen = candidates[0];
        if (!chosen) {
          unfilled++;
          decisions.push({
            shiftId: shift.id, roleId: req.roleId, serverId: null,
            reason: `No eligible server for role ${req.role.code}`,
            rejected,
          });
          continue;
        }

        // Persist
        const created = await prisma.shiftAssignment.create({
          data: {
            shiftId: shift.id,
            serverId: chosen.server.id,
            roleCode: req.role.code,
            reason: `Auto: ${chosen.reasonBits.join("; ")}`,
            assignedBy: "engine",
          },
        });

        // Audit
        await prisma.auditLog.create({
          data: {
            action: "SHIFT_ASSIGN_AUTO",
            entity: "ShiftAssignment",
            entityId: created.id,
            after: created as unknown as object,
            message: `Engine assigned ${chosen.server.firstName} ${chosen.server.lastName} → ${shift.label ?? "shift"} (${req.role.code}). Reason: ${chosen.reasonBits.join("; ")}`,
          },
        });

        // Update live tracking
        liveHours.set(chosen.server.id, (liveHours.get(chosen.server.id) ?? 0) + hoursBetween(shift.startsAt, shift.endsAt));
        // Reflect in candidate object's assignments to prevent re-pick same shift
        chosen.server.assignments.push({
          ...created,
          shift,
        } as any);
        shift.assignments.push(created);

        filled++;
        decisions.push({
          shiftId: shift.id, roleId: req.roleId, serverId: chosen.server.id,
          reason: chosen.reasonBits.join("; "),
          rejected,
        });
      }
    }
  }

  return { filled, unfilled, decisions };
}

/**
 * Clear all non-locked, non-acknowledged auto-assigned shifts for a schedule.
 * Used when the manager wants to re-run auto-scheduler from scratch.
 */
export async function clearUnlockedAssignments(scheduleId: string) {
  const shifts = await prisma.shift.findMany({ where: { scheduleId }, select: { id: true } });
  const ids = shifts.map((s) => s.id);
  if (ids.length === 0) return { deleted: 0 };
  const res = await prisma.shiftAssignment.deleteMany({
    where: { shiftId: { in: ids }, locked: false, acknowledged: false },
  });
  return { deleted: res.count };
}
