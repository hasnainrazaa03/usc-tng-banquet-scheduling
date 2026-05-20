# BEO Pipeline

A **BEO** (Banquet Event Order) is the operational document the events
team produces for every booked event. It tells banquet staff what to set
up, when, where, for whom, with what menu, and how many people.

The system turns a BEO into:

1. A row of `BEO`-related entities (sections, menu, AV, etc.).
2. A set of `Shift` rows on the relevant schedule with `ShiftRequirement`
   rows describing how many of each role are needed.

## Current ingestion paths

| Path | Status |
| --- | --- |
| Manual form (`/beos/new`) | ✅ MVP |
| Paste raw text on `/beos/import` and let `extractBeoFromText()` parse | ✅ MVP (heuristic + optional `OPENAI_API_KEY`) |
| Upload CSV with multiple BEOs | ⏳ Phase 3 |
| Upload PDF and run OCR + `extractBeoFromText()` | ⏳ Phase 3 |

The extractor lives at [`src/lib/ai.ts`](../../src/lib/ai.ts). It works
with or without an OpenAI key:

- **No key:** regex/heuristic extractor pulls obvious tokens (date, time,
  count, location).
- **With key:** the same text is sent to the configured model with a
  strict JSON-schema-shaped prompt; output is validated before writing.

## Deriving shift requirements

`deriveStaffingFromBeo(beo)` (also in `ai.ts`) walks the BEO's sections
and applies the staffing rules from `data/banquet_master_data.json`:

- One captain per N guests (rule `captains_per_guest_count`).
- Ratio of servers per guest depending on service style
  (`plated_ratio`, `buffet_ratio`, `reception_ratio`).
- Add bartenders/barbacks based on bar count.
- Add an AV tech if any section's `avRequirements` is non-empty.

Each derived shift produces a list of `(roleCode, count)` requirement
tuples that are written as `ShiftRequirement` rows.

## Storage shape

```
BEO ──┬── BEOSection (per function: reception, plated, dessert, breakdown)
      ├── BEOMenuItem
      ├── BEOAVItem
      ├── BEOSetupItem
      └── BEONote (handwritten change captures)
```

Each `Shift` then carries:

```
Shift ──┬── ShiftRequirement (role × count)
        └── Assignment (server × role × locked? × reason)
```

This split lets the staffing requirements stay tied to the BEO while
allowing the schedule to be re-run multiple times against the same
requirements.

## Future: bidirectional updates

When an event team updates a BEO (guest count, room change, time shift),
the system should:

1. Diff old vs. new sections.
2. Recompute requirements.
3. **Preserve locked assignments** that are still valid.
4. Mark the schedule as `REVISED` and bump `revisionDate`.

This is the next deliverable on the BEO pipeline.
