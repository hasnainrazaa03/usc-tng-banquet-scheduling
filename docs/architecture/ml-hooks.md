# ML-Ready Scheduling Hooks

The v0.3 engine remains 100% deterministic and rules-based. To prepare for
a future ML scorer without rewriting the engine later, v0.3 ships three
stable surfaces:

## 1. `HistoricalAssignment` (Prisma model)

A flat archive of every assignment the engine produces, plus the score
vector that justified it and the post-hoc outcome signal.

```prisma
model HistoricalAssignment {
  id            String
  shiftId       String
  serverId      String
  roleCode      String
  scheduleId    String
  weekStart     DateTime
  date          DateTime
  startsAt      DateTime
  endsAt        DateTime
  locationCode  String?
  reason        String?      // explanation surfaced to users
  scoreVector   Json?        // { seniority: 0.8, fairness: 0.4, ... }
  engineVersion String?      // "v0.3-rules", "v0.4-ml-blend", ...
  outcome       String?      // WORKED | NO_SHOW | SWAPPED | CANCELLED
  outcomeNotes  String?
}
```

The schema is intentionally append-only. Engine v0.3 does not write to it
yet — wiring lands in v0.4 along with the audit-log subscriber that
captures outcomes from shift status transitions.

## 2. `ScoringPlugin` contract (TypeScript)

`src/lib/scheduling/plugins.ts` defines the interface every future scorer
implements:

```ts
interface ScoringPlugin {
  id: string;
  name: string;
  beforeFilter?(ctx, candidates): ScoringServer[];
  score(ctx, server): number;       // 0..1 normalized recommended
  tiebreak?(ctx, a, b): -1 | 0 | 1;
}
```

A `PluginRegistry` aggregates plugins with weights and computes a single
total score per candidate with a per-plugin breakdown. The breakdown is
exactly the `scoreVector` payload written to `HistoricalAssignment`,
giving a complete training signal:

```
scoreVector = { seniority: 0.87, fairness: 0.31, preference: 0.50, ml: 0.62 }
```

## 3. Engine integration (deferred to v0.4)

The current engine is unchanged in v0.3. The follow-up commit will:

1. Convert the existing seniority / fairness / preference rules into
   built-in plugins behind the same registry.
2. Read the registry inside `runAutoSchedule` between the hard-filter and
   the tiebreak step.
3. Persist `HistoricalAssignment` rows on every assignment write.
4. Allow operators to enable/disable specific plugins per run via
   `EngineOptions.plugins?`.

By landing the persistence + contracts first, the v0.4 ML rollout
becomes a pure additive change instead of an engine rewrite.
