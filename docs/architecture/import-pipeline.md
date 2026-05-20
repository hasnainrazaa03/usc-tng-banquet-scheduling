# Import Pipeline

Files: [`src/lib/import/`](../../src/lib/import/), [`src/lib/master-data/`](../../src/lib/master-data/)

Real USC operational data arrives in a few well-known shapes:

- **`data/banquet_master_data.json`** — venues, roles, rules, templates.
- **Roster spreadsheets** — `.csv` exports of the HR roster + seniority.
- **BEO files** — `.pdf` / `.docx` / pasted text per event.

Each gets its own *adapter* under `src/lib/import/`. All adapters share
three properties:

1. **Typed input**, validated by [zod](https://zod.dev) before any DB write.
2. **Dry-run mode** so ops staff can see the diff without committing.
3. **Transaction-aware** — accept an optional `tx` parameter to participate
   in a larger Prisma `$transaction`.

## Current adapters

| Adapter | File | Status |
| --- | --- | --- |
| Master data | `master-data-importer.ts` | ✅ shipped |
| Roster CSV | `roster-csv-importer.ts` | ⏳ planned |
| BEO CSV | `beo-csv-importer.ts` | ⏳ planned |
| BEO PDF | `beo-pdf-importer.ts` | ⏳ planned |

## Master data importer

```ts
import { importMasterData } from "@/lib/import";

const result = await importMasterData(payload, { dryRun: false });
// {
//   dryRun: false,
//   ok: true,
//   errors: [],
//   counts: { venueGroups: 4, locations: 6, rooms: 5, eventSpaces: 3 }
// }
```

### Validation

The payload is first parsed by `MasterDataSchema` from
[`src/lib/master-data/schema.ts`](../../src/lib/master-data/schema.ts).
Validation errors are returned as zod `issues[]` with no DB writes.

### Normalization

`normalizeMasterData()` converts either of two accepted shapes into a single
`NormalizedVenue[]` array:

- **Nested** (`venueGroups[].locations[].rooms[].spaces[]`) — preferred.
- **Flat** (top-level `locations[]` + `rooms[]`, with `venueGroupCode`
  embedded on each location) — accepted for back-compat with the
  pre-Phase-2 master data file.

### Upsert order

Inside one transaction:

1. `VenueGroup` upsert by `code`.
2. `Location` upsert by `code`, linking `venueGroupId`.
3. `Room` upsert by `(locationId, code)` composite unique.
4. `EventSpace` upsert by `(roomId, code)` composite unique.

This is **idempotent** — re-importing the same JSON yields zero diffs.

### Endpoints + scripts

| Surface | Notes |
| --- | --- |
| `POST /api/master-data` | Validates, supports `?dryRun=1` query, wraps `MasterDataVersion.create` + `importMasterData` + `AuditLog.create` in a single transaction. |
| `npm run seed` (`prisma/seed.ts`) | Calls the same importer so initial seed and ongoing edits share one implementation. |
| `scripts/seed_venues.ts` | One-shot CLI for live DB updates from the current JSON. |

## Adding a new adapter

```ts
// src/lib/import/roster-csv-importer.ts
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

const RowSchema = z.object({
  employeeId: z.string(),
  firstName: z.string(),
  lastName:  z.string(),
  hireDate:  z.string(), // ISO
  classification: z.string(),
  // ...
});
export type RosterRow = z.infer<typeof RowSchema>;

export async function importRosterCsv(
  rows: unknown[],
  opts: { dryRun?: boolean; tx?: PrismaClient } = {},
) {
  // 1. validate every row
  // 2. compute diff vs existing servers (insert/update/skip)
  // 3. if !dryRun, write inside opts.tx ?? prisma
  // 4. return { ok, errors[], counts }
}
```

The `index.ts` barrel re-exports every adapter so callers stay tidy.

## Why this matters

Once we move to real USC data, every operational data file lives behind
a typed adapter with a dry-run path and a transaction. The system is
allergic to ad-hoc one-off scripts that write directly to Prisma — those
inevitably create rows the rest of the system doesn't know how to read.
