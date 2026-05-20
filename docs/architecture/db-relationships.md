# Database Relationships

The canonical source is [`prisma/schema.prisma`](../../prisma/schema.prisma).
This page is the human-readable map.

## Core entities

```
User ─┬─< AuditLog
      └─< Server (1:1 — User.server)

Server ─┬─< Availability
        ├─< TimeOffRequest
        ├─< ShiftPreference
        ├─< Assignment
        ├─< Qualification (via ServerQualification join)
        └── SeniorityRecord (1:1)

VenueGroup ─< Location ─< Room ─< EventSpace

Schedule ─< Shift ─┬─< ShiftRequirement >─ Role
                   ├─< Assignment >─ Server
                   └── BEO?  (optional FK)

BEO ─┬─< BEOSection
     ├─< BEOMenuItem
     ├─< BEOAVItem
     ├─< BEOSetupItem
     └─< BEONote

MasterDataVersion       (single source of truth blob, versioned)
AuditLog                (denormalized event log: who/what/when/diff)
```

## Cascade & delete rules

| Edge | Behavior |
| --- | --- |
| `Location → Room` | `onDelete: Cascade` |
| `Room → EventSpace` | `onDelete: Cascade` |
| `VenueGroup → Location.venueGroupId` | `onDelete: SetNull` — deleting a venue group does not orphan locations. |
| `Schedule → Shift` | `onDelete: Cascade` |
| `Shift → Assignment` | `onDelete: Cascade` |
| `Server → Assignment` | `onDelete: Restrict` — you can't delete an active server with assignments. |

## Identity & ordering

- Every row uses CUID PKs (`@id @default(cuid())`).
- `Schedule.weekStart` is unique per workspace, so generating "this
  week" twice updates rather than duplicates.
- `Server.seniority` ranks via `SeniorityRecord.seniorityRank` (lower
  number = more senior). The engine uses `seniorityScore` for math.

## Status enums

- `Server.status`: `ACTIVE | INACTIVE | ON_LEAVE | TERMINATED`
- `Schedule.status`: `DRAFT | PUBLISHED | REVISED | ARCHIVED`
- `Shift.statusCode`: `NONE | OFF | VAC | MLA | SICK | HOLIDAY | TRAINING`
- `TimeOffRequest.status`: `PENDING | APPROVED | DENIED | CANCELLED`

## Adding a new entity

1. Add the model + relations to `prisma/schema.prisma`.
2. `npx prisma db push` (dev) or `npx prisma migrate dev` (production).
3. `npx prisma generate`.
4. If user-editable, expose through `src/lib/import/` rather than ad-hoc routes.
5. Update this file and bump `CHANGELOG.md` under `[Unreleased]`.
