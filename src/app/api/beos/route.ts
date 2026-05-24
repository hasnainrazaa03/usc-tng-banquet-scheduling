import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { deriveStaffingFromGuests } from "@/lib/ai";
import { syncBeoShifts } from "@/lib/beo-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  const beos = await prisma.bEO.findMany({
    orderBy: { eventDate: "asc" },
    include: { location: true, room: true, manager: { select: { id: true, name: true } } },
  });
  return NextResponse.json(beos);
}

// Phase 5.1 / 7 required-field policy. The manager is intentionally NOT in
// this list anymore: a BEO can be created without a manager and assigned
// from the schedule board later via /api/beos/[id]/manager.
const REQUIRED_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "beoNumber", label: "BEO number" },
  { key: "postAs", label: "Event name" },
  { key: "bookingId", label: "Booking ID" },
  { key: "eventDate", label: "Date" },
  { key: "locationId", label: "Venue" },
  { key: "startTime", label: "Start time" },
  { key: "endTime", label: "End time" },
  { key: "expectedGuests", label: "Guest count" },
];

function isBlank(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "number") return Number.isNaN(v);
  return false;
}

export async function POST(req: NextRequest) {
  await requireRole(["ADMIN", "MANAGER"]);
  const body = await req.json();

  // ── Required-field validation ──
  const missing = REQUIRED_FIELDS.filter((f) => isBlank((body as Record<string, unknown>)[f.key]));
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: "Missing required fields",
        missing: missing.map((m) => m.label),
        missingKeys: missing.map((m) => m.key),
      },
      { status: 400 },
    );
  }

  // ── Resolve venue (Location) + optional room ──
  // The form sends the actual FK ids from /api/options. Legacy import paths
  // may still send a `locationCode` string; fall back to that.
  let locationId: string | null = body.locationId ?? null;
  if (!locationId && body.locationCode) {
    const loc = await prisma.location.findUnique({ where: { code: body.locationCode } });
    locationId = loc?.id ?? null;
    if (!locationId) {
      const room = await prisma.room.findFirst({
        where: { code: body.locationCode },
        select: { locationId: true },
      });
      locationId = room?.locationId ?? null;
    }
  }
  const roomId: string | null = body.roomId ?? null;
  // Manager is optional at creation time — left null until a manager is
  // dragged onto this BEO from the schedule board.
  const rawManagerId = typeof body.managerId === "string" ? body.managerId.trim() : "";
  const managerId: string | null = rawManagerId === "" ? null : rawManagerId;

  // ── Times ──
  const day = new Date(body.eventDate + "T00:00:00");
  const [sh, sm] = (body.startTime ?? "17:00").split(":").map(Number);
  const [eh, em] = (body.endTime ?? "22:00").split(":").map(Number);
  const start = new Date(day); start.setHours(sh, sm, 0, 0);
  const end = new Date(day); end.setHours(eh, em, 0, 0);

  // Derive Banquet-Server-only staffing for the auto-scheduler.
  const staffing = deriveStaffingFromGuests({
    guests: body.expectedGuests ?? 0,
    type: "PLATED_DINNER",
    locationCode: body.locationCode,
  });

  // Free-form notes go into dedicated columns; we keep `setupNotes` for the
  // explicit "staffing notes" the user mentioned in the form.
  const setupNotes: string | null = body.setupNotes?.trim() || body.staffingNotes?.trim() || null;
  const menuJson = body.menu ? { text: String(body.menu).trim() } : null;
  const avJson = body.av ? { text: String(body.av).trim() } : null;

  const beo = await prisma.bEO.create({
    data: {
      beoNumber: body.beoNumber,
      uepaNumber: body.uepaNumber || null,
      postAs: body.postAs,
      account: body.account || null,
      bookingId: body.bookingId,
      contactName: body.contactName || null,
      contactEmail: body.contactEmail || null,
      contactPhone: body.contactPhone || null,
      onsiteContact: body.onsiteContact || null,
      cateringManager: body.cateringManager || null,
      managerId,
      locationId,
      roomId,
      eventDate: day,
      startTime: start,
      endTime: end,
      expectedGuests: body.expectedGuests,
      menu: menuJson ?? undefined,
      av: avJson ?? undefined,
      setupNotes,
      specialInstructions: body.specialInstructions || body.notes || null,
      miscNotes: body.miscNotes || null,
      handwrittenChanges: body.handwrittenChanges || null,
      status: body.status || "DRAFT",
      sections: {
        create: [{
          name: "Main Service",
          functionType: "PLATED_DINNER",
          startTime: start,
          endTime: end,
          guests: body.expectedGuests,
          staffingNeeds: staffing as object,
        }],
      },
    },
  });

  // BEO-driven scheduling: as soon as a BEO is created the matching
  // operational-week Schedule, Event, and Shift(s) appear on the board.
  // Errors here should NOT roll back the BEO — we surface them in the
  // response so the manager can re-run sync from the board if needed.
  let sync: Awaited<ReturnType<typeof syncBeoShifts>> | { error: string } | null = null;
  try {
    sync = await syncBeoShifts(beo.id);
  } catch (e) {
    sync = { error: e instanceof Error ? e.message : String(e) };
  }
  return NextResponse.json({ ...beo, sync });
}
