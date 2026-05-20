# Changelog

All notable changes to the **USC Town & Gown — Banquet Operations Platform** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Versioning policy: `0.x.y` covers MVP and Phase 2 hardening; `1.0.0` is reserved
> for the first production cut over to real USC operational data.

---

## [Unreleased]

### Planned
- Email / SMS shift notifications
- Native CSV / PDF BEO importer
- Employee self-service availability + time-off flows
- Server-side virtualization for very large schedules

---

## [0.2.0] — Phase 2: Architecture, UI/UX, and operational polish

### Added
- **Venue hierarchy:** `VenueGroup` model (UPC, U Club, HSC, USC Hotel) with
  `Location → Room` cascade. `Location` now carries an optional
  `venueGroupId` FK so existing data continues to work.
- **Import adapter framework:** `src/lib/import/` with typed adapters,
  validation, and dry-run support for master data and roster CSVs.
- **Master data versioning + JSON schema:** `data/banquet_master_data.schema.json`
  is now enforced server-side on save (zod).
- **Documentation suite:** `docs/architecture/` covers scheduling engine,
  venue hierarchy, BEO pipeline, drag-and-drop board, and print rendering.
- **CHANGELOG.md** (this file) and semver tagging starting at `v0.2.0`.

### Changed
- **Schedule board redesigned:** server-down × day-across grid with sticky
  header row, sticky server column, conflict and unfilled-shift highlighting,
  improved drag-and-drop ergonomics, role-colored shift chips, density toggle.
- **Print layout redesigned:** proper landscape scaling, dynamic row sizing,
  page breaks every N rows, condensed/full modes, repeating headers, revision
  metadata block.
- **Master data JSON** now groups locations under `venueGroups`. Old flat
  `locations[]` is still accepted by the importer as a fallback.
- **Global design tokens:** tightened typography scale, denser table styles,
  refined shadow + border treatments, USC Cardinal palette polish.

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
