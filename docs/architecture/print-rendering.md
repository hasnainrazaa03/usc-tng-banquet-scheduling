# Print Rendering

File: [`src/app/(app)/schedule/print/`](../../src/app/(app)/schedule/print/)

The printable weekly schedule is the artifact banquet staff actually use
day-to-day. It must:

1. Match the operational paper format used by the existing team.
2. Print cleanly on landscape Letter without manual scaling.
3. Repeat the header on every page.
4. Survive 30+ servers × 7 days without going off-page.
5. Surface unfilled shifts so a manager can see what's missing at a glance.

## Layout

```
┌────────────────────────────────────────────────────────────────┐
│  USC Town & Gown — Weekly Schedule    | Week, Revision, Status │  Header (cardinal underline)
├────────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────────────┤
│ Server │ SUN │ MON │ TUE │ WED │ THU │ FRI │ SAT │ Hrs         │  Sticky table head (repeats)
├────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────────────┤
│ Doe, J │ OFF │ 9-5 │ 9-5 │     │ 4-11│ 4-11│ 6-2 │ 37.0        │
│ …      │     │     │     │     │     │     │     │             │
├────────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────────────┤
│ ⚠ Open Shifts (3 positions)                                    │
│ Day  Time      Location  Role  Need  Event                     │
├────────────────────────────────────────────────────────────────┤
│ Legend: CAP / SVR / BAR / BBK / HSP / AV / SUP                 │
│ Generated …                                                    │
└────────────────────────────────────────────────────────────────┘
```

## How the layout holds up

| Concern | Solution |
| --- | --- |
| Letter landscape | `@page { size: 11in 8.5in landscape; margin: 0.35in; }` |
| Repeat header | `thead { display: table-header-group; }` |
| No torn rows | `tr, .schedule-cell { break-inside: avoid; }` |
| Density control | Root class `print-density-{tight,normal,roomy}` set by `PrintControls.tsx`, persisted in `localStorage` |
| Hide empty rows | Optional toggle adds `.print-hide-empty` to `<html>` and CSS hides `.print-empty-row` |
| Per-server hours | Computed in `PrintSchedule.tsx` from `endsAt − startsAt` (hours), summed per server. |
| Unfilled visibility | Open Shifts table generated from `shifts.requirements vs assignments` diff. |

## File split

| File | Role |
| --- | --- |
| `page.tsx` | Server component: fetches schedule + shifts + servers, serializes them to ISO strings, hands them to two client islands. |
| `PrintControls.tsx` | Tiny client component for the density toggle + "Print/Save PDF" button. Mutates `document.documentElement` classes. |
| `PrintSchedule.tsx` | Client component owning the actual table render + the `useMemo`s for cells/openings/hours. |

Splitting these keeps the serialized payload tiny (no React tree shipped
twice) and lets controls hot-reload independently from the heavy table.

## PDF export

`window.print()` from `PrintControls.tsx` triggers the browser print
dialog, which on macOS/Chrome includes "Save as PDF" as a destination.
This is the supported export path; a future server-side PDF (Puppeteer)
is feasible but unnecessary for current operational needs.
