import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/options
 *
 * Returns the dropdown data the BEO form needs so the UI never has to
 * hardcode venue/room/manager names:
 *
 *   { locations: [{ id, code, name, rooms: [{ id, code, name }] }],
 *     managers:  [{ id, name, email }] }
 *
 * Read-only and lightweight — fine to fetch on every BEO form mount.
 */
export async function GET() {
  const [locations, managers] = await Promise.all([
    prisma.location.findMany({
      orderBy: { name: "asc" },
      include: { rooms: { orderBy: { name: "asc" } } },
    }),
    prisma.user.findMany({
      where: { role: { in: ["MANAGER", "ADMIN"] }, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);
  return NextResponse.json({
    locations: locations.map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      rooms: l.rooms.map((r) => ({ id: r.id, code: r.code, name: r.name })),
    })),
    managers,
  });
}
