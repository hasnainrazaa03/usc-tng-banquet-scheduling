# BUGS & TECH DEBT — USC Private Events & Conferences Scheduling Platform

Living list of known issues. **Resolved** entries are kept for traceability
until they age out (~3 releases). New issues go at the top of their section.

Format: `[severity] short title — symptom — root cause / location — proposed fix`

Severities: **P0** ship-blocker · **P1** broken feature · **P2** UX wart ·
**P3** polish · **TD** tech debt

---

## Open

### P3 — `Room` Prisma model still named "Room"
Domain language is "Venue". Renaming the Prisma model touches every query and
risks regressions; deferred to a dedicated PR.
**Fix:** rename `Room → Venue` (Prisma `@@map("Room")`), then progressively
migrate all `prisma.room.*` callers. See `docs/architecture/venue-hierarchy.md`.

### TD — No tests for DnD board
The Phase 4.1 fix for the scrim-eating-drops bug is currently validated only
manually. We need a Playwright / Vitest+jsdom test that simulates a drop and
confirms the assignment lands on the right shift.

---

## Resolved (recent)

### ✅ Phase 9 — Schedule board stuck on previous operational week
**Symptom:** Today / Prev / Next on the board navigated to the wrong
week. Specifically, "Today" landed on the **previous** Thursday→Wednesday
week in any negative-UTC timezone.
**Root cause:** `WeekNavigator` and `board/page.tsx` parsed bare
`YYYY-MM-DD` strings with `new Date(...)`. JavaScript treats those as
**UTC**, so in PDT they decoded to the previous local day, and
`startOfOperationalWeek` then snapped back another seven days.
**Fix:** added `parseLocalDate(...)` in `src/lib/week-config.ts` and routed
both files through it. All bare-date parsing in the week-nav path is now
timezone-stable.

### ✅ Phase 9 — Schedule board didn't redraw BEOs / counts on week change
**Symptom:** Pressing Prev/Next/Today re-rendered the URL but the BEO
cards, Open / Assigned / Unassigned counts, and servers/managers drawers
still showed the previous week's data.
**Root cause:** `<ScheduleBoard>` is a client island that seeds its
`useState(data.shifts)` only at mount. The router refresh handed it a new
`data` prop but state never re-seeded.
**Fix:** the RSC now renders `<ScheduleBoard key={schedule.id} … />`, so
React unmounts and remounts the island when the operational week changes
and the local state hydrates from the freshly-fetched week.

### ✅ Phase 9 — "Ridiculously high" Open / Assigned / Unassigned counts
Same root cause as above. The counts are derived from `shifts` state and
recompute correctly once the island remounts per week.

### ✅ Phase 9 — Jump-to dropdown was broken and limited
**Symptom:** The Jump-to dropdown only listed weeks with an existing
`Schedule` row, and its onChange handler used `new Date()` so even
in-list weeks could land on the wrong Thursday.
**Fix:** replaced the dropdown with a native `<input type="date">`
calendar picker that snaps any chosen day to its operational Thursday.

### ✅ Phase 9 — Master Data Editor tab removed from UI
The admin master-data JSON editor was redundant with the per-resource
admin pages and confused users. The `Master Data` sidebar entry and the
`/master-data` route are deleted; the underlying `POST /api/master-data`
API and importer remain for seed/import workflows.

### ✅ Phase 9 — Availability was read-only
**Symptom:** `/availability` rendered a static grid; managers had no way
to edit weekly availability without touching the database.
**Fix:** `/availability` is now an editable matrix. Clicking any cell
opens a modal that saves through `PUT /api/availability`. Writes
require ADMIN or MANAGER. Auto-scheduler reads the same rows.

### ✅ Phase 8 — Manager home-venue ownership not persisted
**Symptom:** The 6 department managers seeded with `homeVenues` only carried
that data as a hardcoded constant in `prisma/seed.ts`; nothing reached the DB,
so a future ManagerScopeFilter could not scope dashboards by venue.
**Fix:** added `User.homeVenueCodes String[] @default([])` and the seed now
writes `mgr.homeVenues` into it on every upsert.

### ✅ Phase 8 — Presidential Server ordering parsed from free-text notes
**Symptom:** Presidential rank #1..#7 was buried in `Server.notes` like
`"Presidential Server #2"`, so sorting / tie-breaking required string parsing
at every render.
**Fix:** added `Server.presidentialRank Int?` and the seed derives the value
from the notes regex on import. Roster code can now order on the structured
column directly.

### ✅ Phase 8 — Master-data importer dropped `imagePath`
**Symptom:** `importMasterData` ignored `imagePath` on incoming JSON, so the
admin UI's master-data save would wipe room hero images. The seed worked only
because it post-stamped images from `src/lib/venue-images.ts`.
**Fix:** `imagePath` is now part of `RoomSchema` and `FlatRoomSchema`,
threaded through both branches of `normalizeMasterData`, and written by
`db.room.upsert` (create always sets it; update only overwrites when the JSON
carries a non-empty value, so the seed's `VENUE_IMAGES` fallback still wins
for codes the JSON omits).

### ✅ Phase 8 — Sample BEO booking ID hardcoded to 2026
**Symptom:** Re-seeding in a different calendar year left `BK-2026-1042` on
the demo BEO even though `eventDate` shifted with the current week, making
the ID look stale.
**Fix:** booking id is now `` `BK-${eventDate.getFullYear()}-1042` ``.

### ✅ Phase 8 — `MasterDataVersion` row never written by seed
**Symptom:** The `MasterDataVersion` model existed but only the admin
`POST /api/master-data` route ever wrote to it, so a fresh seed left the
version table empty and the field looked unused.
**Fix:** after `importMasterData` succeeds, the seed stamps the next
monotonic `versionNum` with the raw JSON payload and a "Seed import" note.

### ✅ Phase 7 — Manager required at BEO-creation time blocked event entry
**Symptom:** A BEO couldn't be saved without an assigned manager because
both the form `<select required>` and `POST /api/beos` enforced
`managerId`. Coordinators entering future BEOs often don't yet know who
will run the event.
**Fix:** `managerId` removed from `REQUIRED_FIELDS` on `POST /api/beos`
(empty string normalised to `null`); the form `<select>` lost `required`
and the label was reworded to "optional — assign from board". A new
`PUT /api/beos/[id]/manager` endpoint handles board-side assignment.

### ✅ Phase 7 — Schedule board limited to weeks with a stored Schedule row
**Symptom:** Browsing to `/schedule/board?week=2026-05-21` returned "No
schedule found" unless someone had already pressed Generate Schedule for
that week. Previous/Next arrows hit the same dead-end and BEOs sitting in
the DB for those weeks were invisible.
**Fix:** the board page now anchors the requested date to its operational
Thursday via `startOfOperationalWeek`, calls `ensureWeeklySchedule` to
materialise a Schedule row on demand, then runs `syncBeoShifts` on every
BEO whose `eventDate` lands in that Thursday → Wednesday window. Result:
any week of the year is navigable and any DB-stored BEO auto-appears.

### ✅ Phase 6 — `/schedule/generate` 500 with empty JSON body
**Symptom:** `POST /api/schedule/run` returned a 500 with no body, causing
`form.tsx` to crash with `Unexpected end of JSON input` at the `await
res.json()` call. The page surfaced no error and the run silently failed.
**Fix:** wrapped the entire route handler in try/catch so it always returns
JSON (`{ error }` on failure, never an empty body). The form now reads the
response as text first and `JSON.parse`s defensively, rendering a red error
banner when parsing fails or `res.ok` is false.

### ✅ Phase 6 — `Schedule.weekStart` not anchored to Thursday
**Symptom:** The Generate form defaulted to "today's Sunday" and the API
trusted whatever date you sent, even though TNG operates Thursday→Wednesday.
**Fix:** Form default + API now both pass the date through
`startOfOperationalWeek` (`src/lib/week-config.ts`), guaranteeing every
`Schedule.weekStart` is a Thursday regardless of which day in the week the
manager picks. Schema comments updated for clarity.

### ✅ Phase 6 — BEOs didn't appear on the board until "Generate" was clicked
**Symptom:** Creating a BEO via `/beos/new` only wrote the `BEO` row; the
matching `Event` / `Shift` / `ShiftRequirement` rows weren't created until a
manager explicitly ran `POST /api/schedule/run` for that week.
**Fix:** new `src/lib/beo-sync.ts` is called from `POST /api/beos`
immediately after the BEO is created. It ensures the operational-week
`Schedule` exists, then idempotently creates the Event + Shift(s) +
requirements. The same helper is reused by `/api/schedule/run` for bulk sync.

### ✅ Phase 5.1 — BEO ↔ Manager / Room had no real FK
**Symptom:** `BEO` only stored `cateringManager` as free text; manager dashboards
couldn't be scoped to "BEOs I own", and the BEO form's venue/room/manager were
text inputs with no DB linkage.
**Fix:** added `BEO.managerId → User` and `BEO.roomId → Room` FKs, plus the
reverse relations `User.managedBEOs` and `Room.beos`. `/api/options` exposes
the dropdown data. The new BEO form posts FK ids; `/api/beos` validates the
Phase 5.1 required-field set (BEO number, Event name, Booking ID, Date, Venue,
Times, Guest count, Manager) and returns 400 with field labels on missing.

### ✅ Phase 5.1 — Mixed staff classifications complicated scheduling
**Symptom:** seed shipped a mix of `BANQUET_SERVER` / `BANQUET_CAPTAIN` /
`LEAD_BANQUET_CAPTAIN` / `BARTENDER` classifications, but operationally
every active staff member functions as a Banquet Server for shift fill.
**Fix:** `prisma/seed-test-data.ts` normalises every active `Server.classification`
to `BANQUET_SERVER`. The enum is preserved for historical compatibility.

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
