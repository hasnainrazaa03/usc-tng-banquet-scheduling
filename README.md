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
- **Drag-and-drop schedule board** with sidebar of available servers, role-by-role drop slots, conflict detection, lock/unlock per assignment. Phase 10 added an in-board **ScheduleOpsPanel** with collapsible **Run AI Schedule** and **Recent Schedules** cards, so the standalone "Generate Schedule" page is gone.
- **Collapsible left sidebar (Phase 10)** — toggles between 256px and 64px to maximise board horizontal space; preference persists in `localStorage`.
- **Editable Server Database (Phase 10)** — row-level Edit modal for name / employee ID / hire date; hire-date edits recompute seniority across the roster inside a single Prisma transaction.
- **Manager drag-and-drop on the board (Phase 7)** — managers are no longer required at BEO-creation time. Coordinators save a BEO without one and assign later by dragging a manager pill from the new Managers drawer onto the BEO's manager slot on any shift card. Chips can be dragged between BEOs to reassign or X'd out to clear.
- **Any-week navigation (Phase 7)** — the board page materialises a Thursday→Wednesday `Schedule` row on demand for whatever week the user is viewing, and auto-syncs every BEO in the DB whose `eventDate` lands in that window. Result: previous/next-week arrows work for every week of the year and BEOs already stored in the DB appear without anyone pressing "Generate Schedule" first.
- **Printable weekly schedule** — servers down rows, days across columns, color-coded role/status cells, USC Cardinal header, revision date, meal-break reminder, status legend
- **Role-based access (Phase 11)** — three roles: **Admin** (full system access), **Manager** (BEOs, schedules, time-off approvals, server assignment), **Server** (view own schedule, edit own availability, request own time-off). Sidebar nav and `requireRole` server gates enforce the policy end-to-end.
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

#### Optional: load synthetic test data
```bash
npm run db:seed:test  # 12 synthetic BEOs across next 14 days + availability + time-off
```

This idempotent script (`prisma/seed-test-data.ts`) is safe to re-run. It
normalises every active server's classification to `BANQUET_SERVER`, wipes
any prior synthetic BEOs (tagged `[synthetic-test-data]` in `miscNotes`),
and regenerates a realistic two-week dataset with manager FKs, varied
venues, availability windows, and a small mix of approved + pending
time-off requests so the auto-scheduler exercises conflict / fairness
logic on real data.

### 4. Run the app
```bash
npm run dev
```
Open <http://localhost:3000>.

### 5. Deploy to a real server
Detailed deployment instructions live in **`deployment.md`** at the
project root. That file is **gitignored** — it contains real Neon
credentials and `AUTH_SECRET` values — so each operator maintains
their own copy locally. To generate one, copy the template skeleton
below into a new `deployment.md`:

```bash
# from the project root
touch deployment.md
open -e deployment.md
```

The guide covers: Neon signup + pooled connection string, `.env`
template (`DATABASE_URL`, `AUTH_SECRET` via `openssl rand -base64 32`),
Prisma `db push` / `generate` / seed, local dev, Vercel import +
environment variables, and post-deploy verification.

### Demo accounts (password `password123`)
| Email | Role |
| --- | --- |
| `admin@tng.usc.edu` | ADMIN |
| `manager@tng.usc.edu` | MANAGER |
| `server@tng.usc.edu` | SERVER |
| any `firstname.lastname@usc.edu` from the 32-server roster | SERVER |
| named department managers (e.g. `eddie.cuevas@usc.edu`) | MANAGER |

---

## Testing the auto-scheduler (Phase 12)

After running `npm run db:seed` you can verify the engine end-to-end:

**Run AI Schedule**

1. Sign in at `/login` as `admin@tng.usc.edu` / `password123`.
2. Open **Schedule → Board** in the sidebar.
3. Expand the **Run AI Schedule** panel above the grid.
4. Pick any operational week (Thu → Wed) that has BEOs (the seed creates
   18 of them across May → July). Optionally tick *Clear unlocked
   assignments first* to start from a clean slate.
5. Click **Run Auto-Schedule**.
6. The inline result should report `filled > 0` and the board should now
   show CAP / SVR / BAR chips populated on every shift card, respecting:
   - per-server availability windows (default 06:00–23:59 / all days),
   - RBS qualification for CAP and BAR (every seeded server holds RBS),
   - 10 h minimum rest between shifts,
   - 40 h weekly cap and 6-day max-consecutive guard.

**Fill Unassigned** (top-bar wand icon)

1. With any week open on the board, click **Fill Unassigned**.
2. A green toast appears above the grid: `Fill Unassigned: N filled, M
   still unfilled.` (red toast if the API failed). Auto-dismisses in 6 s.
3. Previously **locked** assignments (lock icon, solid cardinal pill)
   are preserved; only open role slots get filled.

**Drag-and-drop invalid feedback**

1. Open both the **Servers** and **Managers** drawers from the
   right-side toggles.
2. Drag a **server** pill over a **BEO manager slot** at the top of any
   shift card — the slot rings red with a `Ban` icon and "Manager slot
   only" label. Release: nothing happens.
3. Drag a **manager** pill over any **role slot** (CAP/SVR/BAR) — the
   slot rings red with "Server slot only". Release: nothing happens.
4. Drag a **manager** pill over a **BEO manager slot** — cardinal ring,
   drop is accepted, the manager is persisted via
   `PUT /api/beos/{id}/manager`.
5. Drag a **server** pill over a **role slot** — cardinal ring, drop is
   accepted via `POST /api/schedule/assign`.

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

### Call-outs, sick days, no-shows — manager-confirmed replacements

The engine never auto-replaces a no-show. When a server can't make a shift:

1. The manager opens the shift on the board and clicks the red person-minus
   icon on the assignment chip.
2. A confirmation modal records an optional reason and `PATCH`es
   `/api/schedule/callout`. The original assignment row stays on record
   (`calledOut: true` + `calledOutReason` + `calledOutAt` + `calledOutBy`) so
   the call-out is auditable.
3. The same modal then fetches `POST /api/schedule/replace`, which re-uses
   the engine's eligibility filters (qualifications, availability, time-off,
   overlap, weekly cap, min rest) to rank the top candidates. No data is
   mutated here.
4. The manager picks one of the suggestions and the standard
   `/api/schedule/assign` endpoint records the replacement.

Called-out rows are excluded from filled-slot counts, conflict detection,
hour totals, and consecutive-day rules — so the freed slot really is free.

### BEO-driven board

Creating a BEO via `/beos/new` immediately syncs to the operational-week
schedule: `src/lib/beo-sync.ts` ensures the `Schedule` exists, then creates
the matching `Event` + `Shift`(s) + role requirements with 60 min pre-event
and 30 min post-event padding on the shift window. The same helper is
re-used by `POST /api/schedule/run` for bulk sync at week-generation time.
Newly-imported BEOs appear on the board without needing to click "Generate".

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
