# FEATURES — USC Private Events & Conferences Scheduling Platform

Living catalog of features by status. Update entries here as work moves through
states. For history of *shipped* changes see `CHANGELOG.md`.

## Conventions

- **Status icons:** ✅ shipped · 🚧 in progress · 🧭 planned · 💭 idea
- Each row links to the file(s) that own the behavior so newcomers can navigate
  quickly. Codebase paths are workspace-relative.
- "v" tags = first release the feature was available in.

---

## Identity & access

| Status | Feature | Owner | Since |
| --- | --- | --- | --- |
| ✅ | Cookie-based JWT auth (`jose` + `tng_session`) | `src/lib/auth.ts` | v0.1 |
| ✅ | bcrypt password hashes; demo logins for ADMIN / MANAGER / SERVER | `prisma/seed.ts` | v0.4 |
| ✅ | Three-role RBAC (`ADMIN` / `MANAGER` / `SERVER`) with role-filtered Sidebar nav and `requireRole` server-side gates | `src/lib/auth.ts`, `src/components/Sidebar.tsx` | v0.4 (Phase 11) |
| ✅ | Server logins linked 1:1 with `Server` employee records (32 accounts) | `prisma/seed.ts` | v0.4 (Phase 11) |
| ✅ | Named department managers (Juanita Gomez, Leticia Velasquez, Eddie Cuevas, Levi Flefil, Jovon O'Connor, Alonso Recinos) | `prisma/seed.ts` | v0.4 |
| ✅ | Manager home-venue ownership persisted on `User.homeVenueCodes` | schema | v0.4 |

## Master data

| Status | Feature | Owner | Since |
| --- | --- | --- | --- |
| ✅ | Venue hierarchy: `VenueGroup → Location → Room (Venue) → EventSpace` | `prisma/schema.prisma` | v0.2 |
| ✅ | Zod-validated `MasterDataSchema` + idempotent importer (`importMasterData`) | `src/lib/master-data/schema.ts`, `src/lib/import/master-data-importer.ts` | v0.2 |
| ✅ | 4 real USC venue groups + 16 venues seeded from `data/banquet_master_data.json` | `data/banquet_master_data.json`, `prisma/seed.ts` | v0.4 |
| ✅ | Venue hero images stored as `Room.imagePath`, rendered on `/locations` | `src/lib/venue-images.ts`, `src/app/(app)/locations/page.tsx` | v0.4 |
| 🧭 | Admin UI for editing venue groups / rooms / event spaces | — | — |

## Staff

| Status | Feature | Owner | Since |
| --- | --- | --- | --- |
| ✅ | Server roster with classification, status, employee ID | `Server` model | v0.1 |
| ✅ | Editable server records — row-level modal updates name/employee ID/hire date; hire-date edits recompute seniority across the roster inside a transaction | `src/app/(app)/servers/ServersTable.tsx`, `src/app/api/servers/[id]/route.ts`, `src/lib/seniority.ts` | Phase 10 |
| ✅ | Real 32-employee roster (19 FT + 13 PT) with actual hire dates | `prisma/seed.ts` | v0.4 |
| ✅ | `EmploymentType` enum (FULL_TIME / PART_TIME) | `prisma/schema.prisma` | v0.4 |
| ✅ | Presidential Server honorific tracked via `Server.notes` + BANQUET_CAPTAIN classification | `prisma/seed.ts` | v0.4 |
| ✅ | `Server.homeVenueCodes` (string array) for future manager-venue ownership | schema | v0.4 |
| ✅ | Seniority records auto-computed from hireDate; ranked 1..N | `prisma/seed.ts` | v0.3 |
| 🧭 | Availability editor UI | — | — |
| ✅ | Availability editor — click-to-edit per (server × weekday) matrix | `src/app/(app)/availability/editor.tsx`, `src/app/api/availability/route.ts` | Phase 9 |
| ✅ | Time-off request workflow (approve/deny) | `src/app/api/time-off/[id]/route.ts`, `src/app/(app)/time-off/TimeOffTable.tsx` | Phase 13 |

## Scheduling

| Status | Feature | Owner | Since |
| --- | --- | --- | --- |
| ✅ | Thursday→Wednesday operational week (single source: `WEEK_STARTS_ON`) | `src/lib/week-config.ts` | v0.3 |
| ✅ | 5-digit `BEO #` field on every BEO (form + edit + detail header + list + CSV export + schedule board) | `prisma/schema.prisma`, `src/app/(app)/beos/**`, `src/app/(app)/schedule/board/components/ShiftCard.tsx` | v0.5 (Phase 14, font tuned in v0.5.1) |
| ✅ | Schedule board deduplicates BEOs per day — multi-section BEOs collapse to one card; stale `syncBeoShifts` rows are no longer rendered twice | `src/app/(app)/schedule/board/board.tsx`, `src/lib/beo-sync.ts` | v0.5.1 (Phase 15) |
| ✅ | Realistic seeded availability matrix — 6 rotating patterns (mornings / afternoons / weekends / split / full / evenings) so the auto-scheduler's availability filter is actually exercised | `prisma/seed.ts` | v0.5.1 (Phase 15) |
| ✅ | Fresh DB ships with **zero** pre-assigned servers and **zero** pre-picked BEO managers — AI scheduling / click-to-add fills from scratch | `prisma/seed.ts` | v0.5.1 (Phase 15) |
| ✅ | Click-to-add server / manager assignment — replaces drag-and-drop entirely; "+ Add SVR" buttons open a context-scoped picker drawer | `src/app/(app)/schedule/board/board.tsx`, `ShiftCard.tsx`, `ServersDrawer.tsx`, `ManagersDrawer.tsx` | v0.5 (Phase 14) |
| ✅ | Per-BEO collapsible roster — shift cards collapsed by default; server names hidden until expanded; toolbar Expand-all / Collapse-all | `board.tsx`, `ShiftCard.tsx` | v0.5 (Phase 14) |
| ✅ | Cross-venue same-person assignments allowed — system flags as informational "Stacked" badge instead of 409 blocking | `src/app/api/schedule/assign/route.ts`, `board.tsx` | v0.5 (Phase 14) |
| ✅ | Schedule board (click-to-add chips on day & roster grids) | `src/app/(app)/schedule/board/**` | v0.2 (refactored v0.5) |
| ✅ | Run AI Schedule / Fill Unassigned now actually fills — seeded `Availability` + `ServerQualification` + `RoleQualification` rows unblock the engine's hard filters | `prisma/seed.ts`, `src/lib/scheduling-engine.ts` | Phase 12 |
| ✅ | Fill Unassigned toast — top-bar button surfaces a transient `N filled, M unfilled` toast (green/red) above the grid | `board.tsx` | Phase 12 |
| ✅ | Week navigator with prev/next sibling weeks | `src/app/(app)/schedule/board/components/WeekNavigator.tsx` | v0.3 |
| ✅ | Adjacent-week seeds (prev + next) for demo continuity | `prisma/seed.ts` | v0.3 |
| ✅ | Scoring plugin contract + registry stub | `src/lib/scheduling/plugins.ts` | v0.3 |
| ✅ | Auto-scheduler respects required staffing count exactly (never auto-exceeds) | `src/lib/scheduling-engine.ts` | Phase 6 |
| ✅ | Multi-event-per-day server assignments (only blocks on real time overlap / availability / hour rules) | `src/lib/scheduling-engine.ts` | Phase 6 |
| ✅ | Call-out / sick / no-show workflow with manager-confirmed replacements (AI-assisted second) | `src/app/api/schedule/callout/route.ts`, `src/app/api/schedule/replace/route.ts`, `src/app/(app)/schedule/board/components/CalloutModal.tsx` | Phase 6 |
| ✅ | Manual override above required count shown with amber `↑` on shift card | `src/app/(app)/schedule/board/components/ShiftCard.tsx` | Phase 6 |
| ✅ | Manager assignment on the board — click "+ Assign manager" on any BEO header to open a manager picker; cross-venue duplicates are flagged but allowed | `src/app/(app)/schedule/board/components/ManagersDrawer.tsx`, `Draggables.tsx`, `ShiftCard.tsx`, `board.tsx`, `src/app/api/beos/[id]/manager/route.ts` | v0.5 (Phase 14; replaces Phase 7 DnD) |
| ✅ | Any-week navigation — board materialises Schedule on demand for arbitrary Thursday→Wednesday windows | `src/app/(app)/schedule/board/page.tsx`, `src/lib/beo-sync.ts` | Phase 7 |
| ✅ | BEO auto-visibility — any BEO in the DB for the visible week appears without a pre-existing Schedule row | `src/app/(app)/schedule/board/page.tsx`, `src/lib/beo-sync.ts` | Phase 7 |
| ✅ | Manager home-venue ownership persisted on `User.homeVenueCodes` (unblocks future ManagerScopeFilter) | `prisma/schema.prisma`, `prisma/seed.ts` | Phase 8 |
| ✅ | Presidential-Server rank as structured `Server.presidentialRank` column (replaces notes-string parsing) | `prisma/schema.prisma`, `prisma/seed.ts` | Phase 8 |
| ✅ | Master-data importer threads `Room.imagePath` through (admin-UI saves no longer drop room images) | `src/lib/master-data/schema.ts`, `src/lib/import/master-data-importer.ts` | Phase 8 |
| ✅ | `MasterDataVersion` actively written on every seed import (version field no longer unused) | `prisma/seed.ts` | Phase 8 |
| ✅ | Calendar-based week picker (replaces "Jump to" dropdown; snaps any date to its operational Thursday) | `src/app/(app)/schedule/board/components/WeekNavigator.tsx` | Phase 9 |
| ✅ | Robust local-date parsing for `?week=YYYY-MM-DD` (fixes Today / Prev / Next drifting one week in negative-UTC timezones) | `src/lib/week-config.ts` (`parseLocalDate`) | Phase 9 |
| ✅ | Board remounts on week change (`key={schedule.id}` on `<ScheduleBoard>`) — BEOs, counts, drawers all refresh correctly | `src/app/(app)/schedule/board/page.tsx` | Phase 9 |
| ✅ | Unified Schedule Board — Run AI Schedule + Recent Schedules collapsible panel directly on the board (Generate Schedule tab removed) | `src/app/(app)/schedule/board/components/ScheduleOpsPanel.tsx` | Phase 10 |
| 🚧 | Auto-assignment engine wiring (plugins → real assignments) | `src/lib/scheduling/engine.ts` | — |
| 🧭 | ML / historical-learning hooks (read past schedules for preference signals) | — | — |

## BEOs

| Status | Feature | Owner | Since |
| --- | --- | --- | --- |
| ✅ | BEO model + sections + events derived per section | `prisma/schema.prisma` | v0.1 |
| ✅ | BEO detail page renders venue column (renamed from "Room") | `src/app/(app)/beos/[id]/page.tsx` | v0.4 |
| ✅ | Tabbed BEO entry: Form / Text / PDF / PNG with local AI parser | `src/app/(app)/beos/new/page.tsx`, `src/lib/ai.ts`, `src/lib/import/parse-files-client.ts` | Phase 5 |
| ✅ | BEO ↔ Manager FK (`User.managedBEOs`) + Room FK (`Room.beos`) | `prisma/schema.prisma` | Phase 5.1 |
| ✅ | DB-linked Venue / Room / Manager dropdowns on `/beos/new` (via `/api/options`) | `src/app/api/options/route.ts`, `src/app/(app)/beos/new/page.tsx` | Phase 5.1 |
| ✅ | Required-field policy enforced client + server (BEO#, Event, Booking ID, Date, Venue, Times, Guests). Manager optional from Phase 7 — assigned later from the board. | `src/app/api/beos/route.ts` | Phase 5.1 / 7 |
| 🚧 | Handwritten-changes annotation pipeline | `src/lib/import/staging.ts` | — |
| ✅ | One-click BEO → Schedule shift generator (auto-sync on BEO create + bulk on Run) | `src/lib/beo-sync.ts`, `src/app/api/beos/route.ts`, `src/app/api/schedule/run/route.ts` | Phase 6 |
| ✅ | Shift card surfaces event manager + guest count + venue inline | `src/app/(app)/schedule/board/components/ShiftCard.tsx` | Phase 6 |
| ✅ | **BEO editing** — `/beos/[id]/edit` page (ADMIN/MANAGER) with status transitions (DRAFT/CONFIRMED/TENTATIVE/CANCELLED/COMPLETED); `PATCH /api/beos/[id]` with audit log + `syncBeoShifts` | `src/app/(app)/beos/[id]/edit/page.tsx`, `src/app/api/beos/[id]/route.ts` | Phase 11 |
| ✅ | Seeded 10 additional realistic BEOs across ±4 operational weeks | `prisma/seed.ts` | Phase 11 |

## Reporting & print

| Status | Feature | Owner | Since |
| --- | --- | --- | --- |
| ✅ | Weekly print layout with Thu-first columns | master data `printLayout` | v0.3 |
| ✅ | Per-venue group filter on print | `src/app/(app)/schedule/print/page.tsx` (`?vg=`) | Phase 13 |
| ✅ | CSV exports (servers / BEOs / schedule) | `src/app/api/export/route.ts` | Phase 13 |

## Ops & DX

| Status | Feature | Owner | Since |
| --- | --- | --- | --- |
| ✅ | Dockerized PostgreSQL via `colima` | `docker-compose.yml` | v0.1 |
| ✅ | One-command reseed (`prisma db push --force-reset && db:seed`) | `prisma/seed.ts` | v0.1 |
| ✅ | Synthetic test-data loader (`npm run db:seed:test`) | `prisma/seed-test-data.ts` | Phase 5.1 |
| ✅ | Auto-scheduler smoke test script | `prisma/scripts/scheduler-smoke.ts` | Phase 5.1 |
| ✅ | `FEATURES.md` + `BUGS.md` project-management docs | this file | v0.4 |
| ✅ | CI build/test workflow | `.github/workflows/ci.yml` | Phase 13 |
| 🧭 | E2E tests for board DnD | — | — |
