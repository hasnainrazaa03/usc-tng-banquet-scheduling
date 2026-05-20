# Operational Week Configuration

USC Private Events & Conferences treats the week as **Thursday → Wednesday**.
This is the operational cadence catering managers actually plan against
(Thursday is the first BEO-bearing day of most weeks; Wednesday is
reconciliation day).

## Single source of truth: `src/lib/week-config.ts`

| Export | Meaning |
| --- | --- |
| `WEEK_STARTS_ON` | `4` (Thursday, matching JS `getDay()`) |
| `DOW_OPERATIONAL` | `["THU","FRI","SAT","SUN","MON","TUE","WED"]` |
| `startOfOperationalWeek(date)` | Returns the Thursday 00:00 anchor for any date |
| `dowCode(date)` | Returns the `"THU"|"FRI"|...` code |
| `isoLocalDate(date)` | LOCAL `YYYY-MM-DD` string (no UTC drift) |
| `previousWeekStart(d)` / `nextWeekStart(d)` | Sibling-week helpers |

Anywhere else in the codebase that needs to ask "what week does this date
belong to?" delegates here — including `src/lib/utils.ts#startOfWeek` and
the WeekNavigator URL routing.

## Why Thursday?

- BEO arrival cadence: most new BEOs come in late Wednesday afternoon, so
  Thursday is the first "frozen" view of the week.
- Payroll: USC payroll boundaries land Wednesday night, so a Thu→Wed week
  has every shift inside a single pay cycle.
- The legacy scheduling spreadsheet starts on Thursday.

## Scheduling engine note

`src/lib/scheduling-engine.ts` keeps its internal `DAY` enum as native
`SUN..SAT` because the engine only needs each date's calendar weekday for
availability and time-off filtering. The Thursday-first ordering is purely
a presentation concern (board + print + seed iteration order).
