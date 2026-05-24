import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST { shiftId, serverId, roleCode } — manual assign */
export async function POST(req: NextRequest) {
  const session = await requireRole(["ADMIN", "MANAGER", "SUPERVISOR"]);
  const { shiftId, serverId, roleCode } = await req.json();
  if (!shiftId || !serverId) return NextResponse.json({ error: "Missing shiftId/serverId" }, { status: 400 });

  // Conflict detection: same server, overlapping shift
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });

  const conflict = await prisma.shiftAssignment.findFirst({
    where: {
      serverId,
      shift: {
        scheduleId: shift.scheduleId,
        id: { not: shiftId },
        AND: [
          { startsAt: { lt: shift.endsAt } },
          { endsAt: { gt: shift.startsAt } },
        ],
      },
    },
    include: { shift: true },
  });
  if (conflict) {
    return NextResponse.json({
      error: `Conflict: server already on shift "${conflict.shift.label ?? conflict.shiftId}".`,
    }, { status: 409 });
  }

  try {
    const a = await prisma.shiftAssignment.create({
      data: { shiftId, serverId, roleCode: roleCode || null, assignedBy: session.id, reason: "Manual assignment" },
      include: { server: true },
    });
    await prisma.auditLog.create({
      data: { userId: session.id, action: "SHIFT_ASSIGN_MANUAL", entity: "ShiftAssignment", entityId: a.id, after: a as unknown as object },
    });
    return NextResponse.json(a);
  } catch (e: any) {
    return NextResponse.json({ error: "Already assigned" }, { status: 409 });
  }
}

/** DELETE ?id=<assignmentId> */
export async function DELETE(req: NextRequest) {
  const session = await requireRole(["ADMIN", "MANAGER", "SUPERVISOR"]);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const before = await prisma.shiftAssignment.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ ok: true });
  await prisma.shiftAssignment.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId: session.id, action: "SHIFT_UNASSIGN", entity: "ShiftAssignment", entityId: id, before: before as unknown as object },
  });
  return NextResponse.json({ ok: true });
}

/** PATCH { id, locked?, acknowledged?, roleCode? } */
export async function PATCH(req: NextRequest) {
  const session = await requireRole(["ADMIN", "MANAGER", "SUPERVISOR", "EMPLOYEE"]);
  const { id, locked, acknowledged, roleCode } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const updated = await prisma.shiftAssignment.update({
    where: { id },
    data: {
      ...(locked !== undefined ? { locked } : {}),
      ...(acknowledged !== undefined ? { acknowledged } : {}),
      ...(roleCode !== undefined ? { roleCode } : {}),
    },
  });
  await prisma.auditLog.create({
    data: { userId: session.id, action: "SHIFT_ASSIGN_UPDATE", entity: "ShiftAssignment", entityId: id, after: updated as unknown as object },
  });
  return NextResponse.json(updated);
}
