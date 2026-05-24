import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/schedule/callout
 * body: { assignmentId: string, calledOut: boolean, reason?: string }
 *
 * Marks (or unmarks) a server as called-out / sick / no-show on a single
 * shift assignment. The row is kept in the DB for audit but the scheduling
 * engine, conflict detection, and "filled" counts treat it as if the slot
 * were empty, allowing a replacement to be assigned.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "MANAGER"]);
    const body = await req.json().catch(() => ({}));
    const { assignmentId, calledOut, reason } = body as {
      assignmentId?: string;
      calledOut?: boolean;
      reason?: string;
    };
    if (!assignmentId || typeof calledOut !== "boolean") {
      return NextResponse.json(
        { error: "assignmentId and calledOut (boolean) are required" },
        { status: 400 },
      );
    }

    const existing = await prisma.shiftAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const updated = await prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data: {
        calledOut,
        calledOutReason: calledOut ? reason ?? null : null,
        calledOutAt: calledOut ? new Date() : null,
        calledOutBy: calledOut ? session.id : null,
        // A called-out assignment must not stay locked, otherwise the engine
        // would still treat it as protected when re-running fill.
        locked: calledOut ? false : existing.locked,
      },
      include: { server: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: calledOut ? "SHIFT_CALLOUT" : "SHIFT_CALLOUT_UNDO",
        entity: "ShiftAssignment",
        entityId: assignmentId,
        message: calledOut
          ? `Marked called-out: ${updated.server.firstName} ${updated.server.lastName}${reason ? ` (${reason})` : ""}`
          : `Reversed call-out for ${updated.server.firstName} ${updated.server.lastName}`,
        after: updated as unknown as object,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Internal error" }, { status: 500 });
  }
}
