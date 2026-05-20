# USC Town & Gown — Banquet Operations Platform

A full-stack banquet operations platform for **USC Private Events & Conferences** — staff scheduling, BEO management, and venue operations across UPC, HSC, U Club, and USC Hotel.

Built to mirror the existing paper workflow but improve it with AI-assisted
scheduling, drag-and-drop editing, centralized server & BEO data, and a
printable weekly roster that matches the operational paper format.

> **Important:** Scheduling preference is based on **seniority / tenure**
> (years of service), **not age**.

---

## Tech Stack

- **Next.js 14 (App Router)** · TypeScript · Tailwind CSS
- **PostgreSQL** via **Prisma**
- **JWT auth** (`jose` + bcrypt) with role-based access control
- **dnd-kit** for drag-and-drop scheduling
- USC Cardinal & Gold theme, **Fraunces** display + **Inter** body

## Features Delivered (MVP)

- **Staff / Server database** with employee profile, seniority record, qualifications, availability, time-off, hour totals, status
- **BEO management** — full BEO model with multiple sections / functions (reception → plated → breakdown), menu, AV, setup, special instructions, handwritten changes
- **Master data file** at [data/banquet_master_data.json](data/banquet_master_data.json) — locations, rooms, event/function types, setup templates, roles, qualifications, shift codes, status codes (OFF/VAC/MLA/SICK/HOLIDAY/TRAINING), staffing rules, seniority rules, fairness rules, print layout, default templates, common patterns. Versioned and editable from the Master Data Editor page.
- **AI-assisted scheduling engine** ([src/lib/scheduling-engine.ts](src/lib/scheduling-engine.ts)) — filters by availability/time-off/qualifications, applies seniority preference, fairness tiebreakers, weekly hour cap, min-rest, no double-booking. Records explainable reasons on every assignment.
- **Auto-schedule + manual editing** — generate, lock assignments, fill unassigned only, manual override
- **Drag-and-drop schedule board** with sidebar of available servers, role-by-role drop slots, conflict detection, lock/unlock per assignment
- **Printable weekly schedule** — servers down rows, days across columns, color-coded role/status cells, USC Cardinal header, revision date, meal-break reminder, status legend
- **Role-based access** — Admin, Manager, Supervisor, Employee
- **Audit log** for every schedule change, BEO update, master data save
- **Seed data**: 20 servers across ~21 years of tenure, sample BEO (Dornsife Donor Gala), generated schedule + shifts, time-off request, demo accounts

## What's new in Phase 2 (v0.2.0)

- **Venue hierarchy** — `VenueGroup → Location → Room → EventSpace`
  for `UPC`, `U_CLUB`, `HSC`, and `USC_HOTEL`. Backwards-compatible with
  existing flat data. See [docs/architecture/venue-hierarchy.md](docs/architecture/venue-hierarchy.md).
- **Typed import pipeline** — every operational data file (master data,
  future roster CSV, future BEO files) goes through a zod-validated,
  dry-run-capable, transaction-aware adapter under
  [`src/lib/import/`](src/lib/import). See [docs/architecture/import-pipeline.md](docs/architecture/import-pipeline.md).
- **Schedule board redesign** — Day grid + new Roster grid view
  (server-rows × day-columns spreadsheet with sticky header + sticky
  first column), conflict detection, density toggle. See
  [docs/architecture/drag-and-drop.md](docs/architecture/drag-and-drop.md).
- **Print redesign** — proper landscape `@page`, repeating thead,
  density toggle (tight/normal/roomy), per-server weekly hours total,
  Open Shifts callout. See [docs/architecture/print-rendering.md](docs/architecture/print-rendering.md).
- **Architecture docs** — every subsystem is documented under
  [docs/architecture/](docs/architecture/).
- **CHANGELOG.md** + semver tagging starting at `v0.2.0`.

---

## Quick start

### 1. Install Node.js
```bash
brew install node     # or use nvm
```

### 2. Start PostgreSQL
```bash
docker compose up -d
```
This brings up Postgres on `localhost:5432` with the credentials in `.env`.

### 3. Install dependencies and initialize the database
```bash
npm install
npm run setup         # = prisma generate + db push + seed
```

### 4. Run the app
```bash
npm run dev
```
Open <http://localhost:3000>.

### Demo accounts (password `password123`)
| Email | Role |
| --- | --- |
| `admin@tng.usc.edu` | ADMIN |
| `manager@tng.usc.edu` | MANAGER |
| `supervisor@tng.usc.edu` | SUPERVISOR |
| any `firstname.lastname<n>@tng.usc.edu` from the seed | EMPLOYEE |

---

## Project structure

```
data/
  banquet_master_data.json     ← editable master data (locations, roles, rules, …)
prisma/
  schema.prisma                ← all tables (User, Server, BEO, Schedule, Shift, …)
  seed.ts                      ← roster, sample BEO, demo schedule
src/
  app/
    login/                     ← login screen
    (app)/                     ← authenticated app shell
      dashboard/
      beos/                    ← list, detail, new, import
      locations/
      servers/                 ← seniority-ranked roster
      seniority/               ← seniority management
      availability/
      time-off/
      schedule/
        generate/              ← AI-assisted generator
        board/                 ← drag & drop board
        print/                 ← printable weekly view
      audit/
      master-data/             ← JSON editor
    api/
      auth/{login,logout}/
      beos/                    ← list, create, import
      schedule/{run,assign}/
      master-data/
  lib/
    auth.ts                    ← JWT + bcrypt
    db.ts                      ← Prisma client
    scheduling-engine.ts       ← seniority-first auto-scheduler
    ai.ts                      ← BEO text parser + staffing derivation
    utils.ts
  components/
    Sidebar.tsx Topbar.tsx PrintButton.tsx
```

## Scheduling engine — selection order

For each unfilled role on each shift:

1. **Hard filters:** active, qualified, available, no approved time-off,
   no double-booking, ≥ 10h rest from adjacent shifts, weekly hour cap,
   ≤ 6 consecutive days.
2. **Seniority preference:** higher `seniorityScore` (tenure-based) wins.
3. **Fairness tiebreakers:** lower scheduled hours in the rolling window.
4. **Preferences:** preferred location, preferred shift, lead-captain bonus.
5. **Stable name order** for the final tiebreaker.

Every assignment writes a `reason` string the UI can show as an AI explanation.

## Importing / exporting master data

The Master Data Editor page (`/master-data`) lets ops staff upload, edit,
download, and version the `banquet_master_data.json` payload without code
changes. Each save creates a new `MasterDataVersion` row for full history.

## Mobile

Sidebar collapses on mobile; pages use responsive grid + tables scroll
horizontally for dense data.

## Notes & next steps

- Email/SMS notifications for shift assignment acceptance
- Native CSV importer for full BEO sheets
- OpenAI integration for richer BEO extraction (drop your key in `OPENAI_API_KEY`)
- Server self-service: availability editor + accept/decline flow on `/availability` and `/time-off`
- Templates: save common shift patterns per event type and apply with one click

---

## Further reading

- [CHANGELOG.md](CHANGELOG.md) — what changed between versions.
- [docs/architecture/](docs/architecture/) — deep-dives on each subsystem:
  - [scheduling-engine.md](docs/architecture/scheduling-engine.md)
  - [venue-hierarchy.md](docs/architecture/venue-hierarchy.md)
  - [beo-pipeline.md](docs/architecture/beo-pipeline.md)
  - [drag-and-drop.md](docs/architecture/drag-and-drop.md)
  - [print-rendering.md](docs/architecture/print-rendering.md)
  - [db-relationships.md](docs/architecture/db-relationships.md)
  - [import-pipeline.md](docs/architecture/import-pipeline.md)
