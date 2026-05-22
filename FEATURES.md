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
| ✅ | bcrypt password hashes; demo logins for ADMIN/MANAGER/SUPERVISOR | `prisma/seed.ts` | v0.1 |
| ✅ | Named department managers (Juanita Gomez, Leticia Velasquez, Eddie Cuevas, Levi Flefil, Jovon O'Connor, Alonso Recinos) | `prisma/seed.ts` | v0.4 |
| 🧭 | Role-scoped UI (hide Admin nav for non-admins) | `src/app/(app)/layout.tsx` | — |
| 🧭 | Manager home-venue ownership persisted on `User` | schema | — |

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
| ✅ | Real 32-employee roster (19 FT + 13 PT) with actual hire dates | `prisma/seed.ts` | v0.4 |
| ✅ | `EmploymentType` enum (FULL_TIME / PART_TIME) | `prisma/schema.prisma` | v0.4 |
| ✅ | Presidential Server honorific tracked via `Server.notes` + BANQUET_CAPTAIN classification | `prisma/seed.ts` | v0.4 |
| ✅ | `Server.homeVenueCodes` (string array) for future manager-venue ownership | schema | v0.4 |
| ✅ | Seniority records auto-computed from hireDate; ranked 1..N | `prisma/seed.ts` | v0.3 |
| 🧭 | Availability editor UI | — | — |
| 🧭 | Time-off request workflow (approve/deny) | `TimeOffRequest` model | — |

## Scheduling

| Status | Feature | Owner | Since |
| --- | --- | --- | --- |
| ✅ | Thursday→Wednesday operational week (single source: `WEEK_STARTS_ON`) | `src/lib/week-config.ts` | v0.3 |
| ✅ | Schedule board with drag-and-drop server chips | `src/app/(app)/schedule/board/**` | v0.2 |
| ✅ | DnD scrim fix — drops register cleanly, grid no longer blurs when drawer open | `ServersDrawer.tsx`, `board.tsx` | v0.4 |
| ✅ | Week navigator with prev/next sibling weeks | `src/app/(app)/schedule/board/components/WeekNavigator.tsx` | v0.3 |
| ✅ | Adjacent-week seeds (prev + next) for demo continuity | `prisma/seed.ts` | v0.3 |
| ✅ | Scoring plugin contract + registry stub | `src/lib/scheduling/plugins.ts` | v0.3 |
| 🚧 | Auto-assignment engine wiring (plugins → real assignments) | `src/lib/scheduling/engine.ts` | — |
| 🧭 | ML / historical-learning hooks (read past schedules for preference signals) | — | — |

## BEOs

| Status | Feature | Owner | Since |
| --- | --- | --- | --- |
| ✅ | BEO model + sections + events derived per section | `prisma/schema.prisma` | v0.1 |
| ✅ | BEO detail page renders venue column (renamed from "Room") | `src/app/(app)/beos/[id]/page.tsx` | v0.4 |
| 🚧 | BEO PDF / handwritten-changes import pipeline | `src/lib/import/staging.ts` | — |
| 🧭 | One-click BEO → Schedule shift generator | — | — |

## Reporting & print

| Status | Feature | Owner | Since |
| --- | --- | --- | --- |
| ✅ | Weekly print layout with Thu-first columns | master data `printLayout` | v0.3 |
| 🧭 | Per-venue group filter on print | — | — |
| 🧭 | CSV / XLSX exports | — | — |

## Ops & DX

| Status | Feature | Owner | Since |
| --- | --- | --- | --- |
| ✅ | Dockerized PostgreSQL via `colima` | `docker-compose.yml` | v0.1 |
| ✅ | One-command reseed (`prisma db push --force-reset && db:seed`) | `prisma/seed.ts` | v0.1 |
| ✅ | `FEATURES.md` + `BUGS.md` project-management docs | this file | v0.4 |
| 🧭 | CI build/test workflow | — | — |
| 🧭 | E2E tests for board DnD | — | — |
