import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import BEOEditForm from "./BEOEditForm";

export const dynamic = "force-dynamic";

/**
 * Phase 11: BEO edit page.
 *
 * Server component that loads the BEO + supporting option lists (venues,
 * managers) and renders the client-side edit form. ADMIN/MANAGER only —
 * SERVER role bounces to the BEO list (which they can't see anyway).
 */
export default async function EditBEOPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN" && session.role !== "MANAGER") redirect("/dashboard");

  const [beo, locations, managers, rooms] = await Promise.all([
    prisma.bEO.findUnique({
      where: { id: params.id },
      include: { location: true, room: true },
    }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: "MANAGER", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.room.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true, locationId: true } }),
  ]);

  if (!beo) notFound();

  return (
    <BEOEditForm
      beo={{
        id: beo.id,
        postAs: beo.postAs,
        bookingId: beo.bookingId ?? "",
        uepaNumber: beo.uepaNumber ?? "",
        beoNumber: beo.beoNumber ?? "",
        account: beo.account ?? "",
        contactName: beo.contactName ?? "",
        contactPhone: beo.contactPhone ?? "",
        contactEmail: beo.contactEmail ?? "",
        onsiteContact: beo.onsiteContact ?? "",
        cateringManager: beo.cateringManager ?? "",
        managerId: beo.managerId ?? "",
        locationId: beo.locationId ?? "",
        roomId: beo.roomId ?? "",
        eventDate: beo.eventDate.toISOString().slice(0, 10),
        startTime: beo.startTime.toISOString().slice(11, 16),
        endTime: beo.endTime.toISOString().slice(11, 16),
        expectedGuests: beo.expectedGuests ?? 0,
        status: beo.status,
        menu: typeof beo.menu === "object" && beo.menu && "text" in (beo.menu as any) ? String((beo.menu as any).text) : JSON.stringify(beo.menu ?? {}, null, 2),
        av: typeof beo.av === "object" && beo.av && "text" in (beo.av as any) ? String((beo.av as any).text) : JSON.stringify(beo.av ?? {}, null, 2),
        setupNotes: beo.setupNotes ?? "",
        specialInstructions: beo.specialInstructions ?? "",
        miscNotes: beo.miscNotes ?? "",
        handwrittenChanges: beo.handwrittenChanges ?? "",
      }}
      locations={locations.map((l) => ({ id: l.id, name: l.name, code: l.code }))}
      managers={managers}
      rooms={rooms}
    />
  );
}
