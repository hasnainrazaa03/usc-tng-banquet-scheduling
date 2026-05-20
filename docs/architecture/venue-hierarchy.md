# Venue Hierarchy

The USC banquet operation spans four geographically distinct sites with
their own staff, captains, and rooms. Phase 2 introduced a proper
four-level hierarchy so future BEO imports can scale without renaming
anything.

```
VenueGroup ─┬─ Location ─┬─ Room ─┬─ EventSpace
            │            │        └─ EventSpace
            │            └─ Room
            └─ Location
```

## Models

| Model | Purpose |
| --- | --- |
| `VenueGroup` | The four "campuses": `UPC`, `U_CLUB`, `HSC`, `USC_HOTEL` (+ `OTHER`). |
| `Location` | A building or operational unit within a group (e.g. `TNG`, `TCC`, `PED` under `UPC`). |
| `Room` | A physical space within a location (e.g. `GBR`, `BR1`). |
| `EventSpace` | A *setup variant* of a room (e.g. `GBR-FULL`, `GBR-A`, `GBR-B`). |

Why split `Room` and `EventSpace`? Because a single room is regularly
configured several different ways for different events on the same day —
"Grand Ballroom split A vs. full ballroom" — and BEOs specify the *setup*,
not just the room. Without `EventSpace`, BEO imports would either lose
that information or have to invent fake room rows.

## Enum

```prisma
enum VenueGroupCode { UPC U_CLUB HSC USC_HOTEL OTHER }
```

| Code | Display |
| --- | --- |
| `UPC` | University Park Campus |
| `U_CLUB` | University Club |
| `HSC` | Health Sciences Campus |
| `USC_HOTEL` | USC Hotel & Conference Center |
| `OTHER` | Off-site / partner venue |

## Backwards compatibility

- `Location.venueGroupId` is **optional**, so any pre-Phase-2 row that
  doesn't have a group continues to load (it just shows up under an
  "Ungrouped" bucket in the UI).
- `data/banquet_master_data.json` keeps **both** shapes:
  - the new nested `venueGroups[]` tree (preferred),
  - and the legacy flat `locations[]` + `rooms[]` (still accepted by the
    importer).

The importer (`src/lib/import/master-data-importer.ts`) normalizes either
shape into the same `NormalizedVenue[]` structure before writing.

## Seeding

```bash
# One-shot venue import against the running DB:
TS_NODE_PROJECT=tsconfig.json npx tsx scripts/seed_venues.ts
```

Output:

```json
{ "ok": true, "counts": { "venueGroups": 4, "locations": 6, "rooms": 5, "eventSpaces": 3 } }
```

The seed is **idempotent** — re-running updates rather than duplicates.
