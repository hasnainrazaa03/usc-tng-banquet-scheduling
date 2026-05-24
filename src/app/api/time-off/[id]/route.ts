import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import type { TimeOffStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/time-off/:id
 * Body: { status: "APPROVED" | "DENIED" | "CANCELLED" | "PENDING" }
 *
 * ADMIN / MANAGER only. Stamps reviewedBy + reviewedAt on transitions out
 * of PENDING. Audit-logged.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireRole(["ADMIN", "MANAGER"]);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const raw = String((body as { status?: unknown })?.status ?? "");
  const allowed: TimeOffStatus[] = ["APPROVED", "DENIED", "CANCELLED", "PENDING"];
  if (!allowed.includes(raw as TimeOffStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${allowed.join(", ")}` },
      { status: 400 },
    );
  }
  const status = raw as TimeOffStatus;

  const before = await prisma.timeOffRequest.findUnique({
    where: { id: params.id },
  });
  if (!before) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const updated = await prisma.timeOffRequest.update({
    where: { id: params.id },
    data: {
      status,
      reviewedBy: status === "PENDING" ? null : session.id,
      reviewedAt: status === "PENDING" ? null : new Date(),
    },
    include: { server: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.id,
      action: `TIMEOFF_${status}`,
      entity: "TimeOffRequest",
      entityId: params.id,
      before: before as unknown as object,
      after: updated as unknown as object,
    },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    reviewedAt: updated.reviewedAt?.toISOString() ?? null,
  });
}
