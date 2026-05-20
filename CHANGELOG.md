# Changelog

All notable changes to **USC Private Events & Conferences — Banquet Operations Platform** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Versioning policy: `0.x.y` covers MVP and Phase 2/3 hardening; `1.0.0` is reserved
> for the first production cut over to real USC operational data.

---

## [Unreleased]

### Planned
- Email / SMS shift notifications
- Native CSV / PDF BEO importer (full pipeline + UI on top of v0.3 staging)
- Roster CSV promotion (currently stubbed)
- Employee self-service availability + time-off flows
- Server-side virtualization for very large schedules
- ML scoring plugin trained on `HistoricalAssignment` archive

---

## [0.3.0] — Phase 3: Rebrand, venue overhaul, week redesign, ML hooks

### Added
- **Rebrand to USC Private Events & Conferences** (Cardinal & Gold) across
  layout title, login screen, dashboard, sidebar footer, README, architecture
  docs, and engine comments. New favicon (`public/favicon.svg`).
- **Thursday-first operational week** (`src/lib/week-config.ts`) with helpers
  `startOfOperationalWeek`, `dowCode`, `isoLocalDate`, `previousWeekStart`,
  `nextWeekStart`. The schedule board, print view, and seed all iterate days
  Thursday → Wednesday now.
- **Schedule board redesign:** floating Servers Drawer (right slide-over) with
  search + role/location filters, week navigator (Prev / Today / Next + sibling
  dropdown) above the toolbar, density-aware Day grid (compact / comfortable),
  weekend gold tint, persistent prefs in `usc-pec-board-prefs`.
- **Print refinements:** landscape `@page` with print-color-adjust, density
  classes (`print-density-tight|normal|roomy`), header-group repeat, smart
  break utilities (`print-page-break-before`, `print-avoid-break`).
- **Expanded seed data:** prior + next operational weeks (with `findFirst`
  idempotency), HSC Keck School Faculty Reception BEO + shift on next week.
- **ML-ready hooks:** `HistoricalAssignment` Prisma model (assignment archive
  with score vector + outcome signals) and `ScoringPlugin` interface
  (`src/lib/scheduling/plugins.ts`) with a `PluginRegistry` that the engine
  will wire into in v0.4.
- **Import staging:** `ImportStage` Prisma model + `ImportAdapter` contract in
  `src/lib/import/staging.ts`. Roster CSV adapter stub (parse + validate)
  ships now; promotion lands in v0.4.

### Changed
- `Location` listing page renders as `VenueGroup → Location → Venue` tree with
  an orphan section for unmapped locations.
- `Schedule.weekStart` semantics now interpreted as the Thursday anchor;
  `startOfWeek` delegates to `startOfOperationalWeek`.
- Sidebar nav: "Locations" → "Venues"; footer version `v0.3 · Cardinal & Gold`.
- `app/layout.tsx` title template: `"%s · USC Private Events & Conferences"`;
  `viewport` exported separately per Next 14 conventions.

### Fixed
- `/locations` 500 caused by stale Prisma client (now regenerated on schema
  push).
- `api/master-data` duplicate `dryRun` key.
- Seed compile error from stray closing braces left by rebrand replace.

---

## [0.2.0] — Phase 2: Architecture, UI/UX, and operational polish

### Added
- **Venue hierarchy:** `VenueGroup` model (UPC, U Club, HSC, USC Hotel) with
  `Location → Room → EventSpace` cascade. `Location` now carries an
  optional `venueGroupId` FK so existing data continues to work.
- **`EventSpace` model:** for setup variants of a room (e.g. GBR-FULL / GBR-A /
  GBR-B) so future BEOs can pin a configuration without renaming the room.
- **Import adapter framework:** `src/lib/import/` with `importMasterData()`
  — zod-validated, transaction-aware, dry-run capable, idempotent.
- **`src/lib/master-data/schema.ts`:** zod schema + `normalizeMasterData()`
  that accepts both nested (`venueGroups[]`) and legacy flat
  (`locations[]` / `rooms[]`) shapes.
- **`/api/master-data` POST** now validates with zod, supports `dryRun`, and
  wraps version-create + import + audit in a single transaction.
- **`scripts/seed_venues.ts`:** one-shot venue importer for live DB updates.
- **Roster grid view** on the board: server-rows × day-columns with sticky
  top header and sticky left server column, density toggle, openings badge
  per day, conflict warnings, role-colored cells.
- **Conflict detection:** the board now highlights any server assigned to
  two overlapping shifts in red, with a count in the top-bar.
- **Open Shifts callout** on the printable schedule listing every unfilled
  role with day / time / location / role / count needed.
- **CHANGELOG.md** (this file) and semver tagging starting at `v0.2.0`.

### Changed
- **Schedule board redesigned:** day-grid + roster-grid tabs, sticky header,
  sticky server column on the roster view, conflict and unfilled-shift
  highlighting, role-colored shift chips, density toggle, improved
  drag-and-drop ergonomics with proper drag overlay and role-slot drop zones.
- **Print layout redesigned:** proper landscape `@page` with density toggle
  (tight / normal / roomy), repeating thead per printed page,
  page-break-inside-avoid on rows, per-server weekly hours total, paper-sheet
  on-screen preview, revision metadata block, role & status legend.
- **Master data JSON** now groups locations under `venueGroups`. Old flat
  `locations[]` is still accepted by the importer as a fallback.
- **`prisma/seed.ts`** routes through `importMasterData()` so the seed path
  and the API path share one implementation.

### Fixed
- AI BEO extractor now correctly awaited in `/api/beos/import`.
- `prisma.shiftAssignment.findUnique` include statement on the AI
  `explain-assignment` route corrected to use the actual schema relation names
  (`server.seniority`, not `server.seniorityRecord`).

### Migration notes
- Schema additions are additive and non-breaking; existing rows keep working.
- Run `npm run setup` to apply the new schema and reseed venue groups.
- Existing assignments, schedules, and BEOs are preserved.

---

## [0.1.0] — Phase 1: MVP

### Added
- Full-stack scaffold: Next.js 14 App Router + TypeScript + Tailwind +
  Prisma + PostgreSQL + JWT auth.
- 22-table Prisma schema covering users, servers, seniority, availability,
  time-off, qualifications, locations, rooms, BEOs (+ sections), events,
  schedules + versions, shifts, requirements, assignments, locks,
  notifications, audit log, master-data versions.
- Master data file [data/banquet_master_data.json](data/banquet_master_data.json)
  with locations, roles, qualifications, shift codes, status codes,
  staffing rules, seniority rules, fairness rules, print layout, and
  common patterns.
- Scheduling engine ([src/lib/scheduling-engine.ts](src/lib/scheduling-engine.ts))
  applying availability, time-off, qualification, double-booking, min-rest,
  weekly hour cap, and max-consecutive-day constraints with seniority-first
  selection and fairness tiebreakers; writes explainable `reason` on every
  assignment plus an `AuditLog` row.
- AI assist helpers in [src/lib/ai.ts](src/lib/ai.ts): pattern-match
  staffing derivation + OpenAI-aware BEO text extractor with regex fallback.
- AI assist API routes: `/api/ai/extract-beo`, `/api/ai/suggest-staffing`,
  `/api/ai/explain-assignment`.
- All 16 main screens: login, dashboard, BEOs (list/detail/new/import),
  locations, servers, seniority, availability, time-off, schedule
  generate / board / print, audit, master-data.
- Drag-and-drop schedule board (dnd-kit) with lock + conflict detection.
- Printable weekly view (USC Cardinal header, status legend, meal-break
  reminder).
- Role-based access middleware (Admin / Manager / Supervisor / Employee).
- Seed data: 20 servers, sample BEO, demo schedule, demo accounts.

[Unreleased]: https://example.com/compare/v0.2.0...HEAD
[0.2.0]: https://example.com/releases/tag/v0.2.0
[0.1.0]: https://example.com/releases/tag/v0.1.0
