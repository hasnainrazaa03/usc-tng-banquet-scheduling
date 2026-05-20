# Architecture Notes — USC TNG Banquet Operations Platform

This folder documents the moving parts of the system at a level a new
engineer (or a returning author) can pick up in an afternoon. Every file
here covers one concern.

| Doc | Scope |
| --- | --- |
| [scheduling-engine.md](./scheduling-engine.md) | How `generateSchedule()` picks servers, ranks them, and writes assignments. |
| [venue-hierarchy.md](./venue-hierarchy.md) | `VenueGroup → Location → Room → EventSpace` data model and why it exists. |
| [beo-pipeline.md](./beo-pipeline.md) | How a BEO turns into shift requirements; current heuristic + AI hook. |
| [drag-and-drop.md](./drag-and-drop.md) | Board interaction contract: drop IDs, conflict detection, persistence. |
| [print-rendering.md](./print-rendering.md) | How the print page achieves a paper-perfect weekly schedule. |
| [db-relationships.md](./db-relationships.md) | Entity diagram + cascade rules for the Prisma schema. |
| [import-pipeline.md](./import-pipeline.md) | How master data and (future) BEO/roster files get into the DB safely. |

## High-level layering

```
                          ┌────────────────────────────┐
                          │  Next.js App Router (RSC)  │
                          └─────────────┬──────────────┘
                                        │
              ┌─────────────────────────┼──────────────────────────┐
              ▼                         ▼                          ▼
       ┌────────────┐           ┌──────────────┐           ┌────────────┐
       │ src/lib/    │           │ src/app/api  │           │ src/app/   │
       │ scheduling- │◀──────────│ schedule/*   │           │ (app)/*    │
       │ engine.ts   │           │ assign/*     │──────────▶│ board/print│
       │ ai.ts       │           │ beos/*       │           │ generate   │
       └─────┬───────┘           └──────┬───────┘           └────────────┘
             │                          │
             ▼                          ▼
       ┌────────────────────────────────────────┐
       │              Prisma Client             │
       └───────────────────┬────────────────────┘
                           ▼
                   ┌──────────────┐
                   │  PostgreSQL  │
                   └──────────────┘
```

- **`src/lib/`** is the pure-domain layer. No Next, no HTTP. Pure functions
  that take Prisma + inputs and return decisions or write rows. Easy to test.
- **`src/app/api/*`** is the thin HTTP shell — parse, authorize, call `lib`,
  return JSON.
- **`src/app/(app)/*`** is the UI. RSC pages fetch from Prisma directly
  (server components) and pass serialized payloads to small client islands.

## Why this shape

1. **Operational data is messy** — BEOs come in as PDFs/emails, master data
   shifts every quarter as new venues come online. We want one obvious path
   for it to enter the system: an *import adapter* under `src/lib/import/`.
2. **The schedule UI is the riskiest surface** — drag/drop + role slots +
   conflict detection + sticky tables. We isolated it into
   `src/app/(app)/schedule/board/components/*` so each piece can be modified
   without rewriting the whole thing.
3. **The print page must look like the paper one banquet staff use today.**
   It is intentionally a static server-rendered table; the only client state
   is the density toggle stored in `localStorage`.

## Conventions

- All IDs are CUIDs.
- All times are stored as UTC `DateTime`; display formatting is done in the
  view layer with `Intl.DateTimeFormat`.
- Status codes (`OFF`, `VAC`, `MLA`, `SICK`, `HOLIDAY`, `TRAINING`, `NONE`)
  live on `Shift.statusCode` so a "Vacation" shift can still carry an
  assignment row pointing at the server who is off.
- Anything user-editable that should be versioned (master data, schedule
  revisions) writes an audit row via `prisma.auditLog.create`.

See [../../CHANGELOG.md](../../CHANGELOG.md) for what changed between
versions.
