/**
 * Server availability API.
 *
 * Read / upsert / delete the seven-day default-availability windows used by
 * the auto-scheduler and the Availability page. Each `Availability` row is
 * keyed on (serverId, dayOfWeek) — at most one window per server per
 * weekday. Times are stored as "HH:mm" 24-hour strings to match the schema.
 *
 *   GET    /api/availability?serverId=…   → rows for that server
 *   PUT    /api/availability              → upsert one row
 *   DELETE /api/availability?id=…         → remove a row
 *
 * All writes require ADMIN or MANAGER. Reads are open to any signed-in user.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import type { DayOfWeek } from "@prisma/client";

const HHMM = /^\d{2}:\d{2}$/;
const VALID_DOW: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const serverId = req.nextUrl.searchParams.get("serverId");
  const where = serverId ? { serverId } : {};
  const rows = await prisma.availability.findMany({
    where,
    orderBy: [{ serverId: "asc" }, { dayOfWeek: "asc" }],
  });
  return NextResponse.json({ rows });
}

export async function PUT(req: NextRequest) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { serverId, dayOfWeek, startTime, endTime, preference, notes } = body as {
    serverId?: string;
    dayOfWeek?: DayOfWeek;
    startTime?: string;
    endTime?: string;
    preference?: number;
    notes?: string | null;
  };
  if (!serverId) return NextResponse.json({ error: "serverId is required" }, { status: 400 });
  if (!dayOfWeek || !VALID_DOW.includes(dayOfWeek)) {
    return NextResponse.json({ error: "dayOfWeek must be one of SUN..SAT" }, { status: 400 });
  }
  if (!startTime || !HHMM.test(startTime)) {
    return NextResponse.json({ error: "startTime must be HH:mm" }, { status: 400 });
  }
  if (!endTime || !HHMM.test(endTime)) {
    return NextResponse.json({ error: "endTime must be HH:mm" }, { status: 400 });
  }
  if (endTime <= startTime) {
    return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });
  }
  const pref = typeof preference === "number" && [-1, 0, 1].includes(preference) ? preference : 0;

  // Use a find + update / create pair because the schema does not have a
  // unique constraint on (serverId, dayOfWeek). The repo treats one row
  // per server-day as the operational invariant; the API enforces it.
  const existing = await prisma.availability.findFirst({ where: { serverId, dayOfWeek } });
  const row = existing
    ? await prisma.availability.update({
        where: { id: existing.id },
        data: { startTime, endTime, preference: pref, notes: notes ?? null },
      })
    : await prisma.availability.create({
        data: { serverId, dayOfWeek, startTime, endTime, preference: pref, notes: notes ?? null },
      });
  return NextResponse.json({ row });
}

export async function DELETE(req: NextRequest) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await prisma.availability.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
