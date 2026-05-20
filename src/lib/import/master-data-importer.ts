import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import {
  MasterDataSchema,
  normalizeMasterData,
  type MasterData,
} from "@/lib/master-data/schema";

/**
 * Master-data importer.
 *
 * Idempotent upserts for VenueGroup, Location, Room, and EventSpace based on
 * stable codes. Use `dryRun: true` to validate without writing.
 *
 * Returns a `result` object suitable for displaying in the admin UI / logs.
 */
export type ImportResult = {
  dryRun: boolean;
  ok: boolean;
  errors: string[];
  counts: {
    venueGroups: number;
    locations: number;
    rooms: number;
    eventSpaces: number;
  };
};

export async function importMasterData(
  raw: unknown,
  opts: { dryRun?: boolean; tx?: Prisma.TransactionClient } = {},
): Promise<ImportResult> {
  const parsed = MasterDataSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      dryRun: !!opts.dryRun,
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      counts: { venueGroups: 0, locations: 0, rooms: 0, eventSpaces: 0 },
    };
  }

  const data: MasterData = parsed.data;
  const venues = normalizeMasterData(data);

  const counts = { venueGroups: 0, locations: 0, rooms: 0, eventSpaces: 0 };
  if (opts.dryRun) {
    for (const vg of venues) {
      counts.venueGroups++;
      for (const loc of vg.locations) {
        counts.locations++;
        for (const r of loc.rooms) {
          counts.rooms++;
          counts.eventSpaces += r.spaces?.length ?? 0;
        }
      }
    }
    return { dryRun: true, ok: true, errors: [], counts };
  }

  const db = opts.tx ?? prisma;

  for (const vg of venues) {
    const venueGroup = await db.venueGroup.upsert({
      where: { code: vg.code },
      create: {
        code: vg.code,
        name: vg.name,
        shortName: vg.shortName,
        description: vg.description,
      },
      update: {
        name: vg.name,
        shortName: vg.shortName,
        description: vg.description,
      },
    });
    counts.venueGroups++;

    for (const loc of vg.locations) {
      const location = await db.location.upsert({
        where: { code: loc.code },
        create: {
          code: loc.code,
          name: loc.name,
          address: loc.address,
          notes: loc.notes,
          venueGroupId: venueGroup.id,
        },
        update: {
          name: loc.name,
          address: loc.address,
          notes: loc.notes,
          venueGroupId: venueGroup.id,
        },
      });
      counts.locations++;

      for (const r of loc.rooms) {
        const room = await db.room.upsert({
          where: { locationId_code: { locationId: location.id, code: r.code } },
          create: {
            locationId: location.id,
            code: r.code,
            name: r.name,
            capacity: r.capacity ?? null,
            setupTypes: r.setupTypes,
          },
          update: {
            name: r.name,
            capacity: r.capacity ?? null,
            setupTypes: r.setupTypes,
          },
        });
        counts.rooms++;

        for (const sp of r.spaces ?? []) {
          await db.eventSpace.upsert({
            where: { roomId_code: { roomId: room.id, code: sp.code } },
            create: {
              roomId: room.id,
              code: sp.code,
              name: sp.name,
              capacity: sp.capacity ?? null,
              setupCode: sp.setupCode,
            },
            update: {
              name: sp.name,
              capacity: sp.capacity ?? null,
              setupCode: sp.setupCode,
            },
          });
          counts.eventSpaces++;
        }
      }
    }
  }

  return { dryRun: false, ok: true, errors: [], counts };
}
