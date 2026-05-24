import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * PUT /api/beos/:id/manager
 * Body: { managerId: string | null }
 *
 * Assigns / re-assigns / clears the manager on a BEO. Used by the schedule
 * board's manager drag-and-drop. Managers are deliberately *not* enforced
 * at BEO-creation time (Phase 7) so operations can post BEOs first and
 * staff them later.
 *
 * Returns the updated BEO with its manager projection.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireRole(["ADMIN", "MANAGER", "SUPERVISOR"]);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const raw = (body as { managerId?: unknown })?.managerId;
  // Accept both null and "" to mean "clear the manager".
  const managerId: string | null =
    raw === null || raw === undefined || raw === "" ? null : String(raw);

  // Make sure the target user exists and is a manager/admin before pointing
  // a foreign key at them.
  if (managerId) {
    const user = await prisma.user.findUnique({
      where: { id: managerId },
      select: { id: true, role: true, active: true },
    });
    if (!user || !user.active) {
      return NextResponse.json(
        { error: "Manager not found or inactive" },
        { status: 404 },
      );
    }
    if (user.role !== "MANAGER" && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "User is not a manager" },
        { status: 400 },
      );
    }
  }

  const before = await prisma.bEO.findUnique({
    where: { id: params.id },
    select: { id: true, managerId: true },
  });
  if (!before) {
    return NextResponse.json({ error: "BEO not found" }, { status: 404 });
  }

  const beo = await prisma.bEO.update({
    where: { id: params.id },
    data: { managerId },
    select: {
      id: true,
      managerId: true,
      manager: { select: { id: true, name: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.id,
      action: managerId ? "BEO_MANAGER_ASSIGN" : "BEO_MANAGER_UNASSIGN",
      entity: "BEO",
      entityId: params.id,
      before: before as unknown as object,
      after: beo as unknown as object,
    },
  });

  return NextResponse.json(beo);
}
