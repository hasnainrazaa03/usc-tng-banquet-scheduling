import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { syncBeoShifts } from "@/lib/beo-sync";
import type { BEOStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Phase 11: BEO edit support.
 *
 *   GET    /api/beos/[id]   — fetch the full BEO (with relations)
 *   PATCH  /api/beos/[id]   — partial update; only ADMIN / MANAGER
 *   DELETE /api/beos/[id]   — soft-cancel (status=CANCELLED); ADMIN only
 *
 * The PATCH handler accepts any subset of the editable fields. It:
 *   • Validates that the booking ID remains unique if changed.
 *   • Re-stamps `revisionDate` to "now".
 *   • Triggers `syncBeoShifts` so the schedule board picks up any date/
 *     time/location changes immediately.
 *   • Writes an AuditLog entry with before/after snapshots.
 */

const ALLOWED_STATUSES: BEOStatus[] = [
  "DRAFT", "CONFIRMED", "TENTATIVE", "CANCELLED", "COMPLETED",
];

function combineDateTime(dateIso: string, hhmm: string): Date {
  const day = new Date(dateIso + "T00:00:00");
  const [h, m] = hhmm.split(":").map(Number);
  day.setHours(h ?? 0, m ?? 0, 0, 0);
  return day;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await requireRole(["ADMIN", "MANAGER"]);
  const beo = await prisma.bEO.findUnique({
    where: { id: params.id },
    include: { location: true, room: true, manager: { select: { id: true, name: true, email: true } } },
  });
  if (!beo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(beo);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole(["ADMIN", "MANAGER"]);
  const body = await req.json();
  const id = params.id;

  const before = await prisma.bEO.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Guard: bookingId must remain unique if changed.
  if (typeof body.bookingId === "string" && body.bookingId.trim() && body.bookingId !== before.bookingId) {
    const dup = await prisma.bEO.findUnique({ where: { bookingId: body.bookingId } });
    if (dup) return NextResponse.json({ error: "Booking ID already in use" }, { status: 409 });
  }

  // Build the update payload: only include keys actually sent in the body.
  // This lets the client PATCH a single field (e.g. just `status`) without
  // accidentally clobbering the rest.
  const data: Record<string, unknown> = {};

  const stringFields = [
    "postAs", "account", "bookingId", "uepaNumber",
    "contactName", "contactEmail", "contactPhone",
    "onsiteContact", "cateringManager",
    "setupNotes", "specialInstructions", "miscNotes", "handwrittenChanges",
    "billingMethod",
  ];
  for (const k of stringFields) {
    if (k in body) data[k] = body[k] === "" ? null : body[k];
  }
  if ("expectedGuests" in body) {
    const n = Number(body.expectedGuests);
    data.expectedGuests = Number.isFinite(n) ? n : null;
  }
  if ("locationId" in body) data.locationId = body.locationId || null;
  if ("roomId" in body)     data.roomId     = body.roomId || null;
  if ("managerId" in body) {
    const m = typeof body.managerId === "string" ? body.managerId.trim() : "";
    data.managerId = m === "" ? null : m;
  }
  if ("status" in body) {
    if (!ALLOWED_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}` }, { status: 400 });
    }
    data.status = body.status;
  }
  if ("menu" in body) {
    data.menu = typeof body.menu === "string"
      ? (body.menu.trim() ? { text: body.menu.trim() } : null)
      : body.menu;
  }
  if ("av" in body) {
    data.av = typeof body.av === "string"
      ? (body.av.trim() ? { text: body.av.trim() } : null)
      : body.av;
  }

  // Date/time handling: the client sends `eventDate` (YYYY-MM-DD) +
  // `startTime` / `endTime` (HH:MM). We require eventDate to be present
  // whenever either time field changes so the resulting Date is anchored
  // to the right calendar day.
  const dateIso: string | undefined =
    typeof body.eventDate === "string" ? body.eventDate : undefined;
  if (dateIso) {
    const day = new Date(dateIso + "T00:00:00");
    data.eventDate = day;
  }
  if (typeof body.startTime === "string") {
    const anchorIso = dateIso ?? before.eventDate.toISOString().slice(0, 10);
    data.startTime = combineDateTime(anchorIso, body.startTime);
  }
  if (typeof body.endTime === "string") {
    const anchorIso = dateIso ?? before.eventDate.toISOString().slice(0, 10);
    data.endTime = combineDateTime(anchorIso, body.endTime);
  }

  // Always bump the revision date when something material changes.
  if (Object.keys(data).length > 0) data.revisionDate = new Date();

  const after = await prisma.bEO.update({ where: { id }, data });

  // Reflect any date/time/room changes onto the schedule board.
  let sync: Awaited<ReturnType<typeof syncBeoShifts>> | { error: string } | null = null;
  try {
    sync = await syncBeoShifts(after.id);
  } catch (e) {
    sync = { error: e instanceof Error ? e.message : String(e) };
  }

  await prisma.auditLog.create({
    data: {
      userId: session.id,
      action: "BEO_UPDATE",
      entity: "BEO",
      entityId: id,
      before: before as unknown as object,
      after: after as unknown as object,
    },
  });

  return NextResponse.json({ ...after, sync });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  // Soft-cancel only. Hard delete would orphan Events/Shifts; admins should
  // use the seed/QA tools for that.
  const session = await requireRole(["ADMIN"]);
  const before = await prisma.bEO.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const after = await prisma.bEO.update({
    where: { id: params.id },
    data: { status: "CANCELLED", revisionDate: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      userId: session.id,
      action: "BEO_CANCEL",
      entity: "BEO",
      entityId: params.id,
      before: before as unknown as object,
      after: after as unknown as object,
    },
  });
  return NextResponse.json(after);
}
