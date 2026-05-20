# Scheduling Engine

File: [`src/lib/scheduling-engine.ts`](../../src/lib/scheduling-engine.ts)

The engine answers one question: **"For every open role on every shift in
this schedule, who should be assigned?"** It is deliberately deterministic
and explainable — every assignment carries a `reason` string the UI can
surface as an AI explanation.

## Inputs

| Source | Used for |
| --- | --- |
| `Schedule` (week start/end) | Range to plan over. |
| `Shift[]` with `requirements[]` | What needs filling. |
| Existing `Assignment[]` | Locked rows are never overwritten. |
| `Server[]` | The pool. Only `ACTIVE` are considered. |
| `Availability` | Day-of-week + time windows. |
| `TimeOffRequest` (`APPROVED`) | Hard exclusion. |
| `Qualification` | Hard filter when a requirement specifies a role/qualification gate. |
| Master data `staffingRules` / `fairnessRules` | Hour cap, min rest, consecutive day limit, tiebreakers. |

## Pipeline

For each open `(shift, roleCode)` pair, in order of seniority preference:

1. **Hard filters** — eliminate ineligible servers:
   - status `ACTIVE`
   - qualified for `roleCode`
   - has availability that covers `[shift.startsAt, shift.endsAt]`
   - no `APPROVED` time-off overlapping the shift
   - not already on another overlapping shift (no double-book)
   - ≥ 10h rest gap from any neighboring shift
   - weekly hour cap not exceeded
   - ≤ 6 consecutive days worked
2. **Primary preference — seniority**:
   - Higher `seniorityScore` wins. (Score is derived from years of service;
     see [venue-hierarchy.md](./venue-hierarchy.md) for the master-data shape.)
3. **Tiebreakers (in order)**:
   1. Fewer hours scheduled so far in this week (fairness).
   2. Server's `preferredLocations` includes this shift's location.
   3. Server's `preferredShifts` includes this shift's pattern.
   4. Lead-captain bonus when filling a `CAP` slot.
   5. Stable name sort.
4. **Write** an `Assignment { shiftId, serverId, roleCode, reason }` row.
   The `reason` records *why* this server was picked: e.g.
   `"Top seniority (rank #3) and preferred location UPC; CAP role"`.

## "Fill unassigned" semantics

The board's **Fill Unassigned** action calls `/api/schedule/run` with
`clearFirst: false`. The engine then:

- treats every existing `Assignment` as locked (skips its requirement),
- and only fills holes.

This is the safe one-click path after manual edits.

## Re-running from scratch

The generator page (`/schedule/generate`) calls the same endpoint with
`clearFirst: true`. The engine then deletes all *unlocked* assignments
and re-fills.

## Explainability

Every assignment row carries:

- `reason: string` — human text.
- `acknowledged: boolean` — flipped when the assigned server taps "got it"
  in the (future) self-service flow.

The board surfaces `reason` on hover; the `/api/schedule/explain-assignment`
endpoint can produce a richer, longer-form rationale by inspecting the same
candidate set.

## Why deterministic?

USC banquet ops staff need to *understand* and *override* every decision.
We avoid stochastic ranking so that the same input always produces the
same output, and overrides via lock + manual assignment stay stable across
reruns.
