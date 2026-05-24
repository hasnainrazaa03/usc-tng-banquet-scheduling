/**
 * Server detail editing.
 *
 *   PATCH /api/servers/[id]
 *   body: { firstName?, lastName?, employeeId?, hireDate? }
 *
 * Updates basic identity fields on a Server and, when hireDate changes,
 * runs `recalculateAllSeniority` so years-of-service and rank stay in
 * sync across the entire roster — all inside one Prisma transaction.
 *
 * Requires ADMIN or MANAGER.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { recalculateAllSeniority } from "@/lib/seniority";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  let session;
  try {
    session = await requireRole(["ADMIN", "MANAGER"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = ctx.params.id;
  const body = await req.json().catch(() => ({}));
  const { firstName, lastName, employeeId, hireDate } = body as {
    firstName?: string;
    lastName?: string;
    employeeId?: string;
    hireDate?: string;
  };

  const data: Record<string, unknown> = {};
  if (typeof firstName === "string" && firstName.trim()) data.firstName = firstName.trim();
  if (typeof lastName === "string" && lastName.trim()) data.lastName = lastName.trim();
  if (typeof employeeId === "string" && employeeId.trim()) data.employeeId = employeeId.trim();
  let hireDateChanged = false;
  if (typeof hireDate === "string") {
    if (!ISO_DATE.test(hireDate)) {
      return NextResponse.json(
        { error: "hireDate must be YYYY-MM-DD" },
        { status: 400 },
      );
    }
    const parsed = new Date(hireDate + "T00:00:00");
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid hireDate" }, { status: 400 });
    }
    data.hireDate = parsed;
    hireDateChanged = true;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const server = await tx.server.update({
        where: { id },
        data,
        include: { seniority: true },
      });
      if (hireDateChanged) {
        await recalculateAllSeniority(tx);
      }
      const reread = await tx.server.findUnique({
        where: { id: server.id },
        include: { seniority: true },
      });
      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: "SERVER_EDIT",
          entity: "Server",
          entityId: server.id,
          message: `Edited ${server.lastName}, ${server.firstName}` +
            (hireDateChanged ? " (hire date changed → seniority recalculated)" : ""),
          after: data as object,
        },
      });
      return reread;
    });
    return NextResponse.json({ server: updated });
  } catch (e: any) {
    // Prisma unique-constraint violation on employeeId
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "Employee ID is already in use" },
        { status: 409 },
      );
    }
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 },
    );
  }
}
