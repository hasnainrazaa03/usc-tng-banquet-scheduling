import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { deriveStaffingFromGuests } from "@/lib/ai";

export async function GET() {
  const beos = await prisma.bEO.findMany({ orderBy: { eventDate: "asc" }, include: { location: true } });
  return NextResponse.json(beos);
}

export async function POST(req: NextRequest) {
  await requireRole(["ADMIN", "MANAGER"]);
  const body = await req.json();
  // Resolve location by either explicit Location.code or by a Room/Venue code
  // — we pass either through `locationCode` from the import flow.
  let loc = body.locationCode
    ? await prisma.location.findUnique({ where: { code: body.locationCode } })
    : null;
  // Fall back: maybe the caller passed a Room code (TNG, VINEYARD, …); look
  // up the room and use its parent location if present.
  if (!loc && body.locationCode) {
    const room = await prisma.room.findFirst({
      where: { code: body.locationCode },
      include: { location: true },
    });
    loc = room?.location ?? null;
  }

  const day = new Date(body.eventDate + "T00:00:00");
  const [sh, sm] = (body.startTime ?? "17:00").split(":").map(Number);
  const [eh, em] = (body.endTime ?? "22:00").split(":").map(Number);
  const start = new Date(day); start.setHours(sh, sm, 0, 0);
  const end = new Date(day); end.setHours(eh, em, 0, 0);

  const staffing = deriveStaffingFromGuests({
    guests: body.expectedGuests ?? 0, type: "PLATED_DINNER", locationCode: body.locationCode,
  });

  // Combine the free-form sections (menu / AV / contact / notes) into a
  // single setupNotes blob so we don't lose anything the parser caught even
  // before we add dedicated columns.
  const setupBits: string[] = [];
  if (body.setupNotes) setupBits.push(body.setupNotes.trim());
  if (body.menu) setupBits.push(`Menu:\n${body.menu.trim()}`);
  if (body.av) setupBits.push(`A/V:\n${body.av.trim()}`);
  if (body.notes) setupBits.push(`Notes:\n${body.notes.trim()}`);
  const contactLines: string[] = [];
  if (body.contactName) contactLines.push(`Contact: ${body.contactName}`);
  if (body.contactEmail) contactLines.push(`Email: ${body.contactEmail}`);
  if (body.contactPhone) contactLines.push(`Phone: ${body.contactPhone}`);
  if (body.cateringManager) contactLines.push(`Catering Manager: ${body.cateringManager}`);
  if (contactLines.length) setupBits.push(contactLines.join("\n"));
  const setupNotes = setupBits.join("\n\n") || null;

  const beo = await prisma.bEO.create({
    data: {
      postAs: body.postAs,
      account: body.account || null,
      bookingId: body.bookingId || null,
      locationId: loc?.id,
      eventDate: day,
      startTime: start,
      endTime: end,
      expectedGuests: body.expectedGuests,
      setupNotes,
      status: "DRAFT",
      sections: {
        create: [{
          name: "Main Service",
          functionType: "PLATED_DINNER",
          startTime: start,
          endTime: end,
          guests: body.expectedGuests,
          staffingNeeds: staffing as any,
        }],
      },
    },
  });
  return NextResponse.json(beo);
}
