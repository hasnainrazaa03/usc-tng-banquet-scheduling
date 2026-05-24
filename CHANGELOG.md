# Changelog

All notable changes to **USC Private Events & Conferences — Banquet Operations Platform** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Versioning policy: `0.x.y` covers MVP and Phase 2/3 hardening; `1.0.0` is reserved
> for the first production cut over to real USC operational data.

---

## [Unreleased]

## [0.5.1] — Phase 15 (BEO# polish, dedupe, realistic availability, AI audit)

### Changed
- **BEO number font on the schedule board is now `text-base` (1rem) bold
  cardinal display type** instead of the much louder `text-2xl`. Still
  prominent, no longer dominates the card header.
- **Schedule board deduplicates BEOs per day.** Previously a BEO with
  multiple sections (e.g. Reception + Plated Dinner) or stale shifts from
  prior `syncBeoShifts` runs rendered as multiple cards on the same day.
  `byDay` now keeps exactly one Shift per (day, beoId) — the earliest-
  starting one wins. Shifts without a BEO are kept as-is.
- **`syncBeoShifts` no longer synthesises a fallback "Main Service"
  section when the BEO already has Shifts in the target Schedule.** This
  was the second source of duplicate cards on the seeded sample BEO.
- **Realistic seeded availability matrix.** `prisma/seed.ts` replaces the
  prior "every server available 06:00–23:59 all 7 days" stub with 6
  rotating patterns (morning crew / afternoon crew / weekend warriors /
  split / full open / evenings only). 165 availability rows total. This
  makes the auto-scheduler's availability filter actually meaningful
  during testing.
- **Seed leaves every BEO unassigned.** No more pre-seeded ShiftAssignment
  rows, no more pre-seeded `BEO.managerId`. A new "Phase 15 cleanup" step
  at the top of `main()` also wipes any stale ShiftAssignments and clears
  any BEO.managerId on an existing DB the first time the seed is re-run,
  so AI scheduling / click-to-add has a clean board to work on.

### Documentation
- Audited and documented the rules-based scheduling engine
  (`src/lib/scheduling-engine.ts`) — hard filters, scoring, fairness,
  conflicts. See README "AI scheduling — what's actually happening".
- Documented BEO import parsing — PDF via `pdfjs-dist` text extraction,
  PNG via `tesseract.js` OCR, both client-side. Optional LLM-assisted
  field extraction lights up automatically when `OPENAI_API_KEY` is set;
  otherwise a deterministic regex/master-data fallback parses the text.
- Documented where an LLM can live in the stack (extraction now;
  scoring/explanation later) and the deterministic-first guardrails.

### Versioning
- `0.5.0 → 0.5.1` — bumped in `package.json`.

---

## [0.5.0] — Phase 14 (BEO numbers, click-to-add, no DnD)

### Added
- **5-digit BEO number on every BEO.** New `BEO.beoNumber` column
  (`String?`, indexed by `(eventDate, beoNumber)`) — typically 5 digits,
  not globally unique but expected to be unique within an event date. The
  field shows up on:
  - the BEO create form (`/beos/new`) with numeric input, `pattern="\d{3,6}"`,
    placeholder `"e.g. 24831"` and an `inputMode="numeric"` hint;
  - the BEO edit form (`/beos/[id]/edit`) as a separate field from `UEPA #`;
  - the BEO detail page (`/beos/[id]`) as a large `BEO #NNNN` heading;
  - the BEO list (`/beos`) as a dedicated column;
  - the schedule board day-grid: each BEO card's collapsed header now shows
    `#NNNN` in bold cardinal display type so the number is the first thing
    operators see;
  - the CSV export (`/api/export?kind=beos`) as the first column.
  Seeded BEOs receive deterministic numbers (10100+ for sample week, 21000+
  range backfilled for pre-existing rows).
- **Click-to-add server / manager assignment.** Replaces drag-and-drop.
  Each unfilled role slot on a shift card renders a `Add SVR (N open)`
  button; clicking opens a context-scoped picker drawer on the right edge
  listing eligible servers. Click a server pill to assign. Same flow for
  managers via the BEO header's `+ Assign manager` button.
- **Per-BEO collapsible roster.** All shift cards start collapsed on board
  open — the schedule no longer dumps every server name onto the screen.
  Click a card header's chevron to expand and see role slots + chips, or
  use the new toolbar `Expand all` / `Collapse all` buttons.
- **Cross-venue concurrency allowed.** Managers can intentionally schedule
  the same server / manager on overlapping shifts at different venues on
  the same day. The board still flags it (amber "Stacked" badge + ring on
  affected chips) for visibility, but the API no longer blocks. The
  `@@unique([shiftId, serverId])` constraint still prevents exact-slot
  duplicates.

### Changed
- **Schedule board UI refactored.** Removed all drag-and-drop state, drop
  zones, drag overlays, and `@dnd-kit/*` dependencies. The always-open
  side drawers are now picker modals that open from a "+" button. The
  conflict statistic changed from `Conflicts` (red, blocking) to
  `Stacked` (amber, informational).
- **`/api/schedule/assign` no longer 409s on overlap.** Cross-shift
  overlap detection moved client-side as a visual warning.
- **Removed dependencies:** `@dnd-kit/core`, `@dnd-kit/sortable`,
  `@dnd-kit/utilities`.

### Migration
- Schema: `BEO.beoNumber String?` added with composite index
  `(eventDate, beoNumber)`. No data loss; existing rows backfilled by a
  one-off script (`backfill-beonum.ts`, run once and removed) so all
  pre-existing BEOs got numbers in the `21001..` range.
- Run order: `npx prisma db push --accept-data-loss && npx prisma generate
  && npx tsx prisma/seed.ts`.

### Versioning
- `0.4.0 → 0.5.0` — bumped in `package.json`.

---

## [0.4.0] — Phase 13

### Added
- **Phase 13 — Time-off workflow, CSV exports, print filter, CI.**
  - **Time-off approve / deny workflow.** New `PATCH /api/time-off/[id]`
    route (ADMIN/MANAGER) stamps `reviewedBy`/`reviewedAt` and writes an
    `AuditLog` entry (`TIMEOFF_APPROVED|DENIED|CANCELLED|PENDING`). New
    `TimeOffTable` client component on `/time-off` adds status filter pills
    (ALL / PENDING / APPROVED / DENIED / CANCELLED with counts), inline
    Approve / Deny / Reset actions, and `router.refresh()` after each
    transition. Seed now creates 6 sample requests (3 pending, 2 approved,
    1 denied) so the page is non-empty on a fresh seed.
  - **CSV exports.** New `GET /api/export?kind=servers|beos|schedule` route
    (ADMIN/MANAGER) returns a downloadable, BOM-prefixed, fully-quoted CSV.
    Export buttons added to `/servers`, `/beos`, and the schedule board's
    top bar.
  - **Per-venue-group print filter.** `/schedule/print?vg=<code>` filters
    the printable grid to shifts whose `locationCode` belongs to the chosen
    `VenueGroup`. A new venue-group dropdown above the grid drives the
    filter and remembers the active schedule id.
  - **GitHub Actions CI.** New `.github/workflows/ci.yml` runs
    `prisma generate → tsc --noEmit → next build` on every push to `master`
    and pull request. Build is DB-free thanks to `force-dynamic` on every
    route; CI uses dummy `AUTH_SECRET` / `DATABASE_URL`.
  - **MANUAL_SETUP.md.** New gitignored document with step-by-step setup
    notes (GitHub Actions secrets, Vercel env vars, Neon credential
    rotation, re-seed flow, `openssl rand -base64 32`, deferred-item list).

### Added
- **Phase 12 — Drag-and-drop parity & engine fixes.**
  - **Manager DnD parity.** Dragging a manager from the Managers drawer (or
    re-dragging an existing `ManagerChip`) now shows the same `DragOverlay`
    preview, hover ring, and drop animation as the server flow. Drop target
    on every BEO header (`ManagerSlot`) pulses with a `border-cardinal/50`
    halo while a manager drag is in flight to make eligible drop zones
    obvious at a glance.
  - **Invalid-drop visual feedback.** Each drop target now knows the active
    drag kind (`server` / `assignment` / `manager`) via a new `DragKind`
    type plumbed from `board.tsx` through `ShiftCard` to `RoleSlot` and
    `ManagerSlot`. Cross-type drops (e.g. server pill dragged over a
    manager slot, or manager pill dragged over a role slot) paint red
    (`ring-red-400/60`, `cursor-not-allowed`), surface a `Ban` icon, and
    show an inline "Manager slot only" / "Server slot only" label. The
    existing `onDragEnd` already short-circuits these cases, so no
    accidental API writes occur.
  - **Run AI Schedule / Fill Unassigned fix.** Root cause: the seed never
    inserted `Availability` rows for the 32 banquet employees, so
    `inAvailability(server, start, end)` in `scheduling-engine.ts`
    rejected every candidate, and the engine returned `{filled:0,
    unfilled:N}` for every invocation. The seed now creates 7 default
    Availability rows per server (06:00–23:59 window, all weekdays) plus
    `ServerQualification` links to `RBS` and `FOOD_HANDLER`, and seeds the
    missing `RoleQualification` join from `data/banquet_master_data.json`
    so CAP/BAR's RBS requirement is actually enforced.
  - **Top-bar "Fill Unassigned" feedback.** The button now parses the
    response and surfaces a transient toast above the schedule grid
    showing `N filled, M still unfilled` (green) or the error message
    (red). Auto-dismisses after 6 s.
  - **June/July BEO seed expansion.** Added 8 new realistic BEOs
    (`P12-001`…`P12-008`) spanning early June through mid-July across
    UPC/HSC/UCLUB/USCH venues with varied AM/lunch/dinner/reception
    times and staffing levels, including a 480-guest Hall of Fame Gala
    and a 420-guest Orientation Lunch. Total seeded ExtraBEOs is now 18.

### How to test (Phase 12)

**Run AI Schedule**
1. Sign in as `admin@tng.usc.edu` / `password123`.
2. Open **Schedule Board** and expand the **Run AI Schedule** panel.
3. Pick any upcoming operational week (Thu→Wed) and optionally tick
   *Clear unlocked assignments first*.
4. Click **Run Auto-Schedule**.
5. Verify the inline result shows `filled > 0`. Refresh — shift cards
   should now show CAP / SVR / BAR chips populated from the 32-server
   roster, respecting min-rest, weekly cap, and seniority preference.

**Fill Unassigned**
1. On the **Schedule Board** click the top-bar **Fill Unassigned** button
   (wand icon).
2. Watch for the green toast above the grid: `Fill Unassigned: X filled,
   Y still unfilled.`
3. Confirm previously-locked assignments are untouched (lock icon, solid
   cardinal background); only open role slots got filled.

**Invalid drop feedback**
1. From the **Managers** drawer, drag a manager pill. As you hover any
   **role slot** (CAP/SVR/BAR), the slot should ring red with a `Ban`
   icon and a "Server slot only" label; releasing has no effect.
2. From the **Servers** drawer, drag a server pill. As you hover any
   **BEO manager slot**, it rings red with "Manager slot only"; release
   has no effect.
3. Dragging a manager over a manager slot, or a server over a role slot,
   still shows the original cardinal ring + persists normally.

### Added
- **Phase 11 — BEO editing.** New `/beos/[id]/edit` page (ADMIN/MANAGER only)
  with full form coverage of every editable field plus a status dropdown
  (DRAFT / CONFIRMED / TENTATIVE / CANCELLED / COMPLETED). Backed by
  `PATCH /api/beos/[id]` which validates booking-ID uniqueness, accepts
  partial updates, re-stamps `revisionDate`, invokes `syncBeoShifts` so
  the board reflects date/time/location changes immediately, and writes
  an `AuditLog` entry with before/after snapshots.
- **Phase 11 — 10 additional realistic BEOs in the seed**, spread across
  ±4 operational weeks (Engineering reception, Keck luncheon, Athletics
  tailgate, Marshall MBA dinner, hotel breakfast, vineyard wedding,
  Annenberg mixer, trustees lunch, HSC holiday reception, Trojan Family
  brunch). Each gets a Schedule + Event + Shift with appropriate role
  counts so the board and reports show populated data on fresh installs.
- **Phase 11 — every Server gets a linked User**. Server logins
  (`firstname.lastname@usc.edu` / `password123`) now exist for all 32
  roster members so the SERVER role can actually be used end-to-end.

### Changed
- **Phase 11 — RBAC collapsed to three roles.** `UserRole` is now
  `{ ADMIN, MANAGER, SERVER }` (was 4 values). SUPERVISOR and EMPLOYEE
  were collapsed into SERVER because the operational reality is three
  tiers — admins configure the system, managers run the floor, servers
  view their own schedule / availability / time-off. Every
  `requireRole([…, "SUPERVISOR"])` call site has been swept; the
  Sidebar nav now ships role-filtered entries (Servers only see
  Dashboard / My Schedule / My Availability / My Time-Off) and the
  login page demo-account hint reflects the new role names. Legacy
  `supervisor@tng.usc.edu` still resolves — it's upserted with
  `role = SERVER` so historical bookmarks redirect cleanly.
- **Phase 11 — all banquet staff normalised to "Banquet Server".**
  Every `Server.classification` is forced to `BANQUET_SERVER` in the
  seed (the original label is preserved in `Server.notes` as
  `Original classification: …`). The Server Database table now always
  displays "Banquet Server" regardless of the underlying enum value.
  The `JobClassification` enum itself stays intact in the schema for
  future use.
- **Phase 11 — week navigation now chases `router.push` with
  `router.refresh()`** so Prev/Next/calendar-picker deterministically
  reload the RSC payload for the new operational week, even if Next's
  router cache would otherwise skip the fetch.

### Fixed
- **Phase 10.2 — Vercel production build no longer crashes on prerender.**
  Next.js was statically prerendering API route GET handlers (`/api/options`,
  `/api/master-data`, `/api/availability`, `/api/beos`, ...) at build time and
  hitting Neon before tables existed, producing `The table public.Location does
  not exist`. Every `src/app/api/**/route.ts` now exports
  `export const dynamic = "force-dynamic"` so the routes are server-rendered
  on demand instead of at build time. This also makes the build robust against
  a temporarily empty database.
- **Phase 10.2 — Login appeared to succeed but never redirected.**
  `src/lib/auth.ts` and `src/middleware.ts` captured `AUTH_SECRET` at module
  scope. When operators rotated the secret in `.env` / Vercel env vars, the
  dev server hot-reloaded the env but the cached module constants kept the
  stale value → `createSession` signed JWTs with the new secret while
  `getSession`/middleware verified with the old one → every request bounced
  back to `/login`. Both modules now read `process.env.AUTH_SECRET` lazily
  via `getSecret()` on each call.

### Security
- **Phase 10.1 — Removed leaked credentials from tracked docs.** The
  Phase 10 commit (`c93c8f0`) included the live Neon connection string
  and an `AUTH_SECRET` value inside the tracked `deployment.md`.
  `deployment.md` has been rewritten to use placeholders only, then
  removed from git tracking and added to `.gitignore`. The old
  `docs/DEPLOYMENT.md` symlink was deleted so there is exactly one
  deployment guide. **Operators must rotate the Neon role password and
  regenerate `AUTH_SECRET`** — git history still contains the old
  values.

### Fixed
- **Phase 10.1 — Login broken ("Invalid credentials").** Phase 10
  rewrote `.env` to point at a Neon URL whose credentials returned
  `P1000: Authentication failed`. Because [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts)
  surfaces any Prisma error as a generic `Invalid credentials` 401, the
  login form looked like a password problem when it was really a DB
  connection problem. `.env` now points back at the working local
  Postgres URL by default; the deployment guide documents how to swap
  in Neon once you have a valid pooled connection string. No user
  records were lost — the local DB still has the 9 seeded users with
  unchanged `password123` bcrypt hashes.

### Added
- **Phase 10 — Unified Schedule Board.** The standalone "Generate
  Schedule" page is gone; its functionality lives on the board itself
  inside a new `ScheduleOpsPanel`
  ([src/app/(app)/schedule/board/components/ScheduleOpsPanel.tsx](src/app/(app)/schedule/board/components/ScheduleOpsPanel.tsx)).
  Two collapsible cards — **Run AI Schedule** and **Recent Schedules** —
  sit directly above the day columns so managers can browse historical
  weeks, kick off the AI auto-scheduler, and jump between sibling
  schedules without leaving the board.
- **Phase 10 — Collapsible sidebar.** [src/components/Sidebar.tsx](src/components/Sidebar.tsx)
  now toggles between 256px and 64px widths, persists the choice in
  `localStorage`, and uses `title` tooltips when collapsed. Toggle via
  the `PanelLeftClose` / `PanelLeftOpen` icon in the header.
- **Phase 10 — Editable Server Database.** New
  [src/app/(app)/servers/ServersTable.tsx](src/app/(app)/servers/ServersTable.tsx)
  renders a pencil button per row that opens a modal for first/last
  name, employee ID, and hire date. Saving hits
  [src/app/api/servers/[id]/route.ts](src/app/api/servers/%5Bid%5D/route.ts),
  which runs a single `prisma.$transaction`: update server fields →
  recompute `yearsOfService` / `seniorityScore` / `seniorityRank` for
  every active server via [src/lib/seniority.ts](src/lib/seniority.ts) →
  write an `AuditLog` entry. ADMIN / MANAGER only.
- **Phase 10 — Root-level `deployment.md`.** Verbatim
  Neon connection string, `.env` template,
  `openssl rand -base64 32` AUTH_SECRET command, Vercel + Prisma fix
  notes, and a manual-steps checklist.
  `docs/DEPLOYMENT.md` is now a symlink to this canonical file.

### Fixed
- **Phase 10 — Vercel `PrismaClientInitializationError` during build.**
  Vercel caches `node_modules` between builds, which left the generated
  Prisma client out of sync with the committed schema and tripped
  `Collecting page data for /api/ai/explain-assignment`. Fixed in
  [package.json](package.json) by adding
  `"postinstall": "prisma generate"` and changing
  `"build"` to `"prisma generate && next build"` so every Vercel build
  regenerates the client deterministically.

### Removed
- **Phase 10 — `/schedule/generate` route.** The page and its form are
  deleted; the API route `/api/schedule/run` is retained because both
  Fill Unassigned and the new in-board "Run AI Schedule" panel still
  call it.

---

## [0.9.0] — Phase 9

### Added
- **Phase 9 — Calendar-based week picker on the schedule board.** A native
  `<input type="date">` replaces the old "Jump to" dropdown. Picking any
  date snaps the board to that day's Thursday → Wednesday operational
  week, so users can browse arbitrary weeks of the year — not only weeks
  with a pre-existing `Schedule` row.
- **Phase 9 — Editable per-day server availability.** `/availability` is
  now a click-to-edit matrix. Cell click opens a time-range modal that
  saves through the new `PUT /api/availability` endpoint
  (`src/app/api/availability/route.ts`). ADMIN / MANAGER only.
- **Phase 9 — `docs/DEPLOYMENT.md`.** Step-by-step backend + database
  deployment guide: Vercel + Neon (recommended) and Render (alternative).
  Includes sign-up flow, environment variables, `prisma db push`, seed,
  and a post-deploy verification checklist.

### Changed
- **Phase 9 — Robust local-date parsing on the board.** New
  `parseLocalDate` helper in `src/lib/week-config.ts` parses bare
  `YYYY-MM-DD` strings in **local** time. Both `WeekNavigator` and
  `schedule/board/page.tsx` route through it, fixing Today / Prev / Next
  landing on the previous operational week in negative-UTC timezones.
- **Phase 9 — Board remounts per operational week.** `<ScheduleBoard>` is
  now rendered with `key={schedule.id}` so its `useState`-seeded local
  shifts hydrate from the freshly-fetched week. Side-effects: BEO cards,
  Open / Assigned / Unassigned counts, and the Servers / Managers
  drawers all refresh correctly on week change. Previously the counts
  inflated because state carried over between weeks.
- **Phase 9 — Master Data Editor removed from the UI.** The sidebar entry
  and `/master-data` route are gone. The `POST /api/master-data` API and
  importer are retained for seed/import workflows.

### Added
- **Phase 8 — Manager venue ownership persisted on `User`.** New `User.homeVenueCodes String[]` column. The seed now writes each named manager's `homeVenues` into the DB (e.g. `["TNG"]`, `["VINEYARD","UPC"]`), unblocking a future ManagerScopeFilter that scopes the board / dashboards to "events at my venues".
- **Phase 8 — Presidential-Server rank as a structured column.** New `Server.presidentialRank Int?`. The seed parses `"Presidential Server #N"` out of free-text notes into the column, so the roster can sort and tie-break on it without string parsing at render time.
- **Phase 8 — `MasterDataVersion` written on every seed.** After `importMasterData` succeeds, the seed stamps the next monotonic `versionNum` along with the raw JSON payload and a `"Seed import — N venues / M rooms"` note. The version table is no longer empty on fresh databases.

### Changed
- **Phase 8 — Master-data importer now reads `Room.imagePath`.** `RoomSchema` and `FlatRoomSchema` accept `imagePath`, `normalizeMasterData` threads it through both branches, and `importMasterData` writes it on create. On update it only overwrites when the JSON carries a non-empty value, so the seed's `VENUE_IMAGES` fallback continues to win for codes the JSON omits. An admin-UI master-data save no longer wipes existing room hero images.
- **Phase 8 — Sample BEO booking id derived from event year.** The hardcoded `BK-2026-1042` in `prisma/seed.ts` is now `` `BK-${eventDate.getFullYear()}-1042` ``, so re-seeding in 2027+ produces a non-stale demo id.

### Added
- **Phase 7 — Manager drag-and-drop on the schedule board.** Managers no longer have to be chosen at BEO-creation time; they're assigned (and reassigned, and cleared) from the board itself.
  - New floating **Managers** drawer on the board (right-edge, non-modal, same pattern as Servers). Search by name, filter by role.
  - Every shift card whose event is backed by a BEO now exposes a **manager drop zone** under the staffing header. Dashed placeholder when empty, a draggable chip when filled. The chip has an X to clear.
  - `POST` is replaced by drag: drag a manager pill from the drawer (or an existing chip from another card) onto a BEO's manager slot.
  - Backed by `PUT /api/beos/{id}/manager` — accepts `{ managerId: string|null }`, validates the target user is active and role MANAGER/ADMIN, writes a `BEO_MANAGER_ASSIGN` / `BEO_MANAGER_UNASSIGN` audit log entry.
- **Phase 7 — Any-week navigation on the schedule board.** The board now materialises whichever operational week the user is looking at instead of requiring a pre-generated `Schedule` row. `WeekNavigator`'s prev/next arrows and the date jumper work for arbitrary weeks of the year.
- **Phase 7 — BEO auto-visibility.** When the board loads a week, every BEO whose `eventDate` falls in that Thursday → Wednesday window is run through `syncBeoShifts` (idempotent), so a BEO created without ever pressing "Generate Schedule" still appears on the board for its week.

### Changed
- **`POST /api/beos` — manager is now optional.** `managerId` removed from `REQUIRED_FIELDS`; empty string is normalised to `null` so a BEO can be saved without a manager and assigned later from the board.
- **BEO form (`/beos/new`)** — the Manager dropdown is no longer `required` and is labelled as optional with a hint that assignment can happen from the schedule board.
- **`/schedule/board` page resolution** — when neither `?id` nor a known `?week=YYYY-MM-DD` resolves to a stored schedule, the page now calls `ensureWeeklySchedule(anchorThursday)` and proceeds, instead of bailing out with "No schedule found".

### Added
- **BEO-driven scheduling** — `src/lib/beo-sync.ts` is the single source of truth that, given a BEO, ensures the operational-week `Schedule` exists and has the matching `Event` + `Shift`(s) + role requirements. Called automatically from both `POST /api/beos` (so a newly-created BEO appears on the board immediately) and `POST /api/schedule/run` (bulk sync at week-generation time). Pre/post-event padding (60 min pre, 30 min post) is applied to shift windows so servers arrive early and stay for breakdown.
- **Call-out / sick / no-show workflow** — new `ShiftAssignment` columns `calledOut`, `calledOutReason`, `calledOutAt`, `calledOutBy`. Manager hits the red user-minus icon on an assignment chip → confirmation modal records the reason → `PATCH /api/schedule/callout` flips the flag → `POST /api/schedule/replace` returns the top eligible replacements (same rules as the auto-scheduler, no auto-assign) → manager picks one and the standard `/api/schedule/assign` endpoint records the replacement. Original assignment stays on record for audit. Manager-controlled first, AI-assisted second.
- **Shift cards now show manager + guest count** — board query now eagerly loads `event.beo.{manager, location, room, expectedGuests}` so each shift card surfaces the event's manager name, guest count, and venue inline.
- **Sick stat badge** on the board header counts currently called-out assignments at a glance.
- **API: `POST /api/schedule/replace`** — read-only endpoint that ranks replacement candidates for a given called-out assignment by re-using the engine's eligibility filters (qualifications, availability, time-off, overlap, weekly cap, min rest). Does not mutate any data.
- **API: `PATCH /api/schedule/callout`** — marks (or un-marks) an assignment as called-out with an audit trail.

### Changed
- **Auto-scheduler ignores called-out assignments** — `runAutoSchedule` now excludes `calledOut: true` rows from filled-slot counts, overlap conflict checks, weekly-hour totals, consecutive-day counts, and "already on this shift" rejections. Multi-event-per-day server assignments continue to be allowed as long as time windows don't overlap.
- **Auto-scheduler still respects required staffing count exactly** — the engine fills *up to* `ShiftRequirement.count` per role and never auto-exceeds it. Managers can still drag additional servers in beyond the requirement; the shift card shows an amber `↑` indicator when that happens so over-staffing is visible.
- **Operational week is enforced end-to-end** — `Schedule.weekStart`/`weekEnd` comments updated to "Thursday 00:00 → Wednesday 23:59". The Generate Schedule form now defaults to the current operational Thursday (was: Sunday) and visibly previews the anchored Thursday date the user's pick will resolve to. `POST /api/schedule/run` normalises whatever date you send through `startOfOperationalWeek` so picking any day in the week still anchors correctly.

### Fixed
- **`/schedule/generate` 500 + `Failed to execute 'json' on 'Response'`** — `form.tsx` now reads the response as text first, JSON-parses defensively, and renders a visible red error banner instead of crashing the page on an empty or non-JSON body. `POST /api/schedule/run` is wrapped in a try/catch that always returns `{ error }` JSON (validates `weekStart` shape, returns 400 instead of throwing). No more silent crash when the BEO sync step throws.
- **Board overlap detection** ignores called-out assignments so a freshly-dragged replacement isn't flagged as conflicting with the original call-out.

---

## [Phase 5.1] — 2026-05-21

### Added
- **BEO ↔ Manager relationship** — `BEO.managerId` and `BEO.roomId` are now real FKs (`User`, `Room`) instead of free-text. `User.managedBEOs` / `Room.beos` reverse relations added so managers and rooms can list their own BEOs.
- **`/api/options` endpoint** — single read-only endpoint returning every venue (Location), its rooms, and every active manager/admin user. Used by the BEO form to power the new dropdowns.
- **BEO form: dropdown selectors + required-field policy** — `/beos/new`:
  - **Venue** is now a dropdown of all `Location` rows (DB-linked, no more hardcoded codes).
  - **Room / sub-venue** is a dependent dropdown that filters to the selected venue's rooms (optional).
  - **Manager** is a dropdown of every active `MANAGER`/`ADMIN` user (linked via the new FK).
  - Fields explicitly marked required (asterisk + HTML `required` + 400 on POST): **BEO number, Event name, Booking ID, Date, Venue, Start/End time, Guest count, Manager**.
  - Optional fields persist into their own columns (contact info, on-site contact, catering manager notes, menu, A/V, special instructions, miscellaneous notes, revised notes, staffing notes).
- **Synthetic test data** — `prisma/seed-test-data.ts` (`npm run db:seed:test`) generates:
  - 12 varied BEOs across the next 14 days (different venues, day/night, guest counts 30–320), each linked to a manager FK.
  - Realistic availability windows for every active server (full-time vs part-time presets so the scheduler has true coverage gaps to solve).
  - 5 time-off requests (2 approved, 3 pending) so conflict-handling and fairness logic exercise on real data.
  - All synthetic rows are tagged in `miscNotes` (`[synthetic-test-data]`) so re-runs are safely idempotent.
- **Scheduler smoke test** — `prisma/scripts/scheduler-smoke.ts` clears assignments and runs `runAutoSchedule` against the current + next operational weeks, printing fill counts and top rejection reasons.
- **`fmtHireDate` helper** — formats hire dates as `MM/DD/YYYY` (year always shown). Used on the Server Database and Seniority pages.

### Changed
- **Staff classification normalised to `BANQUET_SERVER`** — `seed-test-data` updates every active `Server.classification` to `BANQUET_SERVER`, replacing prior captain/lead labels. The enum is preserved for historical compatibility; new data treats all staff as Banquet Servers.

### Fixed
- POST `/api/beos` now persists `menu` / `av` / `specialInstructions` / `miscNotes` / `handwrittenChanges` / `onsiteContact` into their dedicated columns instead of collapsing them into `setupNotes`. Returns 400 with field labels when required fields are missing.

---

## [Phase 5] — 2026-05-21

### Added
- **BEO import overhaul** — `/beos/new` is now a single tabbed surface with four entry modes:
  - **Form** — manual entry (existing behaviour, expanded fields).
  - **Text** — paste raw BEO text; parser extracts and pre-fills the form.
  - **PDF** — upload a text-based PDF; client-side `pdfjs-dist` extracts text per page (read order preserved), then runs the BEO field parser.
  - **PNG / Image** — upload a PNG/JPG/WEBP; client-side Tesseract.js OCR with live progress bar, then runs the BEO field parser.
- Extended local BEO extractor (`src/lib/ai.ts`) to recognise: event date (ISO / US / long-form), venue (matched against 16 USC room codes), setup notes, menu, A/V, additional notes, on-site contact (name/email/phone), catering manager, and a coarse confidence score.
- POST `/api/beos` now accepts and persists the extra free-form fields (menu, A/V, notes, contact info) into `setupNotes`, and resolves `locationCode` against both `Location.code` and `Room.code`.
- "Imported from {source}" banner on the form with a low-confidence warning and a one-click Clear button so users always review parsed data before saving.

### Fixed
- **Board DnD: drag handle UX** — `AssignmentChip` no longer renders `cursor-grab` on its full surface; the cursor only changes over the actual name handle so lock/remove buttons feel like buttons again.
- **Board DnD: assignment overlay** — `<DragOverlay>` now shows a moving chip when re-assigning an existing slot, not just when dragging from the Servers drawer.
- **Roster grid: sticky-column bleed** — the sticky first column now uses an explicit per-row opaque background (`bg-white` / `#f5f0eb`) matching the row stripe, instead of `bg-inherit` which let scrolling content show through.

### Changed
- `/beos/import` is now a permanent redirect to `/beos/new` — old bookmarks and the nav Import link keep working.

### Planned
- Email / SMS shift notifications
- Native CSV / PDF BEO importer (full pipeline + UI on top of v0.3 staging)
- Roster CSV promotion (currently stubbed)
- Employee self-service availability + time-off flows
- Server-side virtualization for very large schedules
- ML scoring plugin trained on `HistoricalAssignment` archive

---

---

## [0.4.0] — Phase 4: Real operational data + DnD fix

**Released:** unreleased (tag pending)

### Added
- **Real USC venue catalog.** `data/banquet_master_data.json` now ships the
  authoritative venue tree: 4 venue groups (UPC, HSC, U Club, USC Hotel) →
  16 real venues with capacities, setup types, and event-space subdivisions
  for Town & Gown's Grand Ballroom.
- **Venue hero images.** Each `Room` carries an `imagePath` column populated
  from `src/lib/venue-images.ts` at seed time. The `/locations` page now
  renders a hero image per venue card.
- **Real 32-employee roster.** `prisma/seed.ts` replaces the prior synthetic
  20-server pool with 19 full-time and 13 part-time real employees, including
  hire dates from 1995-08-28 through 2025-07-28 and Presidential-Server
  honorifics #1..#7 captured on `Server.notes`.
- **6 named department managers** seeded as `User` records with role=MANAGER:
  Juanita Gomez, Leticia Velasquez, Eddie Cuevas, Levi Flefil,
  Jovon O'Connor, Alonso Recinos. Login: `<first>.<last>@usc.edu` /
  `password123`.
- **`EmploymentType` enum** (`FULL_TIME` / `PART_TIME`) on `Server`.
- **`Server.homeVenueCodes String[]`** for forthcoming manager-venue
  ownership filtering.
- **`Room.imagePath String?`** for venue hero art.
- **`FEATURES.md` and `BUGS.md`** project-management docs at repo root.

### Fixed
- **Schedule-board drag-and-drop drops were silently swallowed when the
  servers drawer was open.** The drawer's full-viewport scrim
  (`fixed inset-0 backdrop-blur-[1px] pointer-events-auto`) both blurred the
  grid via a CSS backdrop filter and intercepted every pointer event outside
  the drawer, so every drop landed on the scrim's `onClick={onClose}`
  instead of a shift cell. Removed the scrim entirely (drawer is now
  non-modal) and added `paddingRight` on the board root so the grid stays
  visible and droppable while the drawer is open.
  See `BUGS.md → Resolved → v0.4`.

### Changed
- **`/beos/[id]` page:** column header "Room" → "Venue" (UI label only; the
  Prisma model is still named `Room` — see `BUGS.md` for the rename plan).
- **Master data `printLayout.header`** simplified to
  "USC Private Events & Conferences — Weekly Schedule"; columns are now
  Thu-first to match the operational week.

### Notes
- The Prisma `Room` model still uses its original name; renaming to `Venue`
  is tracked as a separate effort to avoid a sweeping refactor in this
  release.
- Manager `homeVenues` are currently documented only as a constant in the
  seed; persisting them on `User` is tracked in `BUGS.md`.

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
