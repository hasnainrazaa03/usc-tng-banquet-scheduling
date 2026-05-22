# BUGS & TECH DEBT — USC Private Events & Conferences Scheduling Platform

Living list of known issues. **Resolved** entries are kept for traceability
until they age out (~3 releases). New issues go at the top of their section.

Format: `[severity] short title — symptom — root cause / location — proposed fix`

Severities: **P0** ship-blocker · **P1** broken feature · **P2** UX wart ·
**P3** polish · **TD** tech debt

---

## Open

### P3 — Manager home-venue ownership not persisted
The 6 named department managers seeded in v0.4 carry their `homeVenues` only as
a hardcoded constant in `prisma/seed.ts`. There's no `User.homeVenueCodes`
column yet, so the UI cannot scope manager dashboards by venue.
**Fix:** add `homeVenueCodes String[] @default([])` to `User`, populate during
seed, and wire into a future ManagerScopeFilter.

### P3 — Presidential Server ordering is implicit
Presidential Server #1..#7 ordering is recorded in `Server.notes` as free
text rather than a structured column, so we cannot sort the roster by
presidential rank without parsing strings.
**Fix:** add `Server.presidentialRank Int?` and use it in seniority tie-breakers.

### P3 — `Room` Prisma model still named "Room"
Domain language is "Venue". Renaming the Prisma model touches every query and
risks regressions; deferred to a dedicated PR.
**Fix:** rename `Room → Venue` (Prisma `@@map("Room")`), then progressively
migrate all `prisma.room.*` callers. See `docs/architecture/venue-hierarchy.md`.

### TD — Master-data importer ignores `imagePath`
`importMasterData` does not read `imagePath` from the JSON; instead the seed
hard-stamps `Room.imagePath` from `src/lib/venue-images.ts` after import.
Works for now, but a non-seed importer run (e.g. admin UI) would not set
images.
**Fix:** add `imagePath` to `RoomSchema` in `src/lib/master-data/schema.ts`
and have the importer pass it through.

### TD — Sample BEO booking ID is hardcoded
`BK-2026-1042` is hardcoded in the seed. Re-running the seed across calendar
years will leave the booking dated to the seed-time week but the ID will look
stale.
**Fix:** derive bookingId from current year, e.g. `BK-${year}-1042`.

### TD — No tests for DnD board
The Phase 4.1 fix for the scrim-eating-drops bug is currently validated only
manually. We need a Playwright / Vitest+jsdom test that simulates a drop and
confirms the assignment lands on the right shift.

### TD — Master data version field is unused
`MasterDataVersion` model exists but the importer doesn't increment it.

---

## Resolved (recent)

### ✅ v0.4 — DnD drops were silently swallowed when servers drawer was open
**Symptom:** Dragging a server chip into a shift cell while the drawer was
visible appeared to succeed but no assignment landed; the grid also looked
blurry.
**Root cause:** `ServersDrawer.tsx` rendered a full-viewport scrim with
`fixed inset-0 z-30 backdrop-blur-[1px] pointer-events-auto`. The CSS backdrop
filter blurred the grid and the scrim intercepted all pointer events outside
the drawer, so `onDragEnd` always fired against the scrim's `onClick={onClose}`
instead of a shift cell.
**Fix:** removed the scrim entirely — the drawer is now non-modal. Added
`paddingRight` on the board root so the grid stays visible/droppable while the
drawer is open.

### ✅ v0.4 — Placeholder venue codes (TNG, TCC, PED, UCLUB, HSC-MAIN, USCH)
**Symptom:** master data shipped with invented venue codes that did not match
USC's real operational structure.
**Fix:** rewrote `data/banquet_master_data.json` with 4 real venue groups
(UPC, HSC, U Club, USC Hotel) containing 16 real venues, plus hero images for
each. Replaced the 20 synthetic servers in `prisma/seed.ts` with the real
32-employee roster (19 FT + 13 PT) and 6 named department managers.

### ✅ v0.3 — Schedule.weekStart treated as unique key
**Symptom:** `prisma.schedule.upsert({ where: { weekStart } })` failed to
compile because `weekStart` is only `@@index`, not `@unique`.
**Fix:** switched to the `findFirst` + conditional `create` pattern across
the seed and the schedule generator.

### ✅ v0.3 — Sunday-anchored weeks across the codebase
Replaced ad-hoc `startOfWeek(date, { weekStartsOn: 0 })` calls with the
single-source-of-truth `startOfOperationalWeek` from `src/lib/week-config.ts`.
