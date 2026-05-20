import { z } from "zod";

/**
 * Master-data schema (v2).
 *
 * Backward compatible: top-level `venueGroups` is the canonical shape, but
 * flat `locations[]` + `rooms[]` are still accepted as a fallback so older
 * exports continue to import cleanly.
 */

const RoomSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  capacity: z.number().int().positive().nullable().optional(),
  setupTypes: z.array(z.string()).default([]),
  spaces: z.array(z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    capacity: z.number().int().positive().nullable().optional(),
    setupCode: z.string().optional(),
  })).optional(),
});

const LocationNestedSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  address: z.string().optional(),
  notes: z.string().optional(),
  rooms: z.array(RoomSchema).default([]),
});

export const VenueGroupCodeEnum = z.enum(["UPC", "U_CLUB", "HSC", "USC_HOTEL", "OTHER"]);
export type VenueGroupCode = z.infer<typeof VenueGroupCodeEnum>;

const VenueGroupSchema = z.object({
  code: VenueGroupCodeEnum,
  name: z.string().min(1),
  shortName: z.string().optional(),
  description: z.string().optional(),
  locations: z.array(LocationNestedSchema).default([]),
});

const FlatLocationSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  address: z.string().optional(),
  notes: z.string().optional(),
  venueGroupCode: VenueGroupCodeEnum.optional(),
});

const FlatRoomSchema = z.object({
  locationCode: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  capacity: z.number().int().positive().nullable().optional(),
  setupTypes: z.array(z.string()).default([]),
});

export const MasterDataSchema = z.object({
  $schema: z.string().optional(),
  version: z.number().int().positive(),
  department: z.object({
    name: z.string(),
    shortName: z.string().optional(),
    timezone: z.string().optional(),
    weekStartsOn: z.string().optional(),
  }).passthrough(),
  venueGroups: z.array(VenueGroupSchema).optional(),
  locations: z.array(FlatLocationSchema).optional(),
  rooms: z.array(FlatRoomSchema).optional(),
}).passthrough();

export type MasterData = z.infer<typeof MasterDataSchema>;

/** Normalized representation used by the importer + UI. */
export type NormalizedVenue = {
  code: VenueGroupCode;
  name: string;
  shortName?: string;
  description?: string;
  locations: NormalizedLocation[];
};

export type NormalizedLocation = {
  code: string;
  name: string;
  address?: string;
  notes?: string;
  venueGroupCode?: VenueGroupCode;
  rooms: NormalizedRoom[];
};

export type NormalizedRoom = {
  code: string;
  name: string;
  capacity?: number | null;
  setupTypes: string[];
  spaces?: { code: string; name: string; capacity?: number | null; setupCode?: string }[];
};

/**
 * Normalize either nested (`venueGroups[]`) or flat (`locations[]` + `rooms[]`)
 * payloads into the unified `NormalizedVenue[]` structure consumed by the
 * importer and UI.
 */
export function normalizeMasterData(data: MasterData): NormalizedVenue[] {
  if (data.venueGroups && data.venueGroups.length > 0) {
    return data.venueGroups.map((vg) => ({
      code: vg.code,
      name: vg.name,
      shortName: vg.shortName,
      description: vg.description,
      locations: vg.locations.map((loc) => ({
        code: loc.code,
        name: loc.name,
        address: loc.address,
        notes: loc.notes,
        venueGroupCode: vg.code,
        rooms: loc.rooms.map((r) => ({
          code: r.code,
          name: r.name,
          capacity: r.capacity ?? null,
          setupTypes: r.setupTypes ?? [],
          spaces: r.spaces,
        })),
      })),
    }));
  }

  // Fallback: assemble groups from flat lists.
  const byGroup = new Map<VenueGroupCode, NormalizedVenue>();
  const ensure = (code: VenueGroupCode): NormalizedVenue => {
    if (!byGroup.has(code)) {
      byGroup.set(code, { code, name: code, locations: [] });
    }
    return byGroup.get(code)!;
  };

  const locByCode = new Map<string, NormalizedLocation>();
  for (const loc of data.locations ?? []) {
    const group = ensure(loc.venueGroupCode ?? "OTHER");
    const normalized: NormalizedLocation = {
      code: loc.code,
      name: loc.name,
      address: loc.address,
      notes: loc.notes,
      venueGroupCode: group.code,
      rooms: [],
    };
    group.locations.push(normalized);
    locByCode.set(loc.code, normalized);
  }
  for (const room of data.rooms ?? []) {
    const loc = locByCode.get(room.locationCode);
    if (!loc) continue;
    loc.rooms.push({
      code: room.code,
      name: room.name,
      capacity: room.capacity ?? null,
      setupTypes: room.setupTypes ?? [],
    });
  }

  return Array.from(byGroup.values());
}
