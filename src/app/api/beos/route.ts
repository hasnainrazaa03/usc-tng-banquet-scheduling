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
  const loc = body.locationCode ? await prisma.location.findUnique({ where: { code: body.locationCode } }) : null;

  const day = new Date(body.eventDate + "T00:00:00");
  const [sh, sm] = (body.startTime ?? "17:00").split(":").map(Number);
  const [eh, em] = (body.endTime ?? "22:00").split(":").map(Number);
  const start = new Date(day); start.setHours(sh, sm, 0, 0);
  const end = new Date(day); end.setHours(eh, em, 0, 0);

  const staffing = deriveStaffingFromGuests({
    guests: body.expectedGuests ?? 0, type: "PLATED_DINNER", locationCode: body.locationCode,
  });

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
      setupNotes: body.setupNotes || null,
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
