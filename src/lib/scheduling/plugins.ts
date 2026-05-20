/**
 * USC Private Events & Conferences — Scheduling Plugin Contracts
 * ────────────────────────────────────────────────────────────────
 * v0.3 introduces a plugin surface so future scorers (heuristic,
 * historical, ML-trained) can extend the deterministic engine
 * without rewriting it.
 *
 * The current engine in `scheduling-engine.ts` is rules-based and
 * does NOT yet invoke these plugins. They are defined here so the
 * persistence layer (`HistoricalAssignment`), the dataset shape, and
 * the integration points are stable when the ML scorer ships.
 *
 * Lifecycle hooks (in selection order):
 *   beforeFilter(ctx)  — drop candidates before hard-filter math
 *   score(ctx, server) — produce a numeric score (higher wins)
 *   tiebreak(ctx, a,b) — return -1, 0, or 1 for equal-score pairs
 *
 * A plugin is free to implement only the hooks it cares about; the
 * registry merges them. Built-in scorers (seniority, fairness,
 * preference) are conceptually plugins too and can be re-prioritized
 * by changing the weights map.
 */

import type {
  Server,
  SeniorityRecord,
  Availability,
  TimeOffRequest,
} from "@prisma/client";

/** Minimal projection of a server passed to scoring plugins. */
export type ScoringServer = Server & {
  seniority: SeniorityRecord | null;
  availability: Availability[];
  timeOff: TimeOffRequest[];
};

/** Shift + role context for a single selection decision. */
export type ScoringContext = {
  shiftId: string;
  roleCode: string;
  date: Date;
  startsAt: Date;
  endsAt: Date;
  locationCode: string | null;
  /** Days already worked by each server in the fairness window. */
  hoursByServerId: Record<string, number>;
  /** Historical no-show / swap counts, when available. */
  outcomesByServerId?: Record<string, { noShows: number; swaps: number; worked: number }>;
};

export interface ScoringPlugin {
  /** Stable identifier; used for weights map + audit trail. */
  readonly id: string;
  /** Human-readable name surfaced in decision explanations. */
  readonly name: string;

  /** Optional: drop candidates before any other plugin runs. */
  beforeFilter?(ctx: ScoringContext, candidates: ScoringServer[]): ScoringServer[];

  /** Required: return a score for a single candidate (0..1 normalized recommended). */
  score(ctx: ScoringContext, server: ScoringServer): number;

  /** Optional: deterministic tiebreak for ties at the same score. */
  tiebreak?(ctx: ScoringContext, a: ScoringServer, b: ScoringServer): -1 | 0 | 1;
}

/**
 * In-memory plugin registry. Engine integration is deferred to a
 * follow-up commit (v0.4); this lives here so plugin authors can
 * start writing scorers + tests against a stable contract today.
 */
export class PluginRegistry {
  private plugins = new Map<string, { plugin: ScoringPlugin; weight: number }>();

  register(plugin: ScoringPlugin, weight: number = 1.0): void {
    if (weight < 0) throw new Error("Plugin weight must be non-negative");
    this.plugins.set(plugin.id, { plugin, weight });
  }

  unregister(id: string): void {
    this.plugins.delete(id);
  }

  list(): { plugin: ScoringPlugin; weight: number }[] {
    return Array.from(this.plugins.values());
  }

  /** Compute the weighted aggregate score across all registered plugins. */
  scoreCandidate(ctx: ScoringContext, server: ScoringServer): {
    total: number;
    breakdown: Record<string, number>;
  } {
    const breakdown: Record<string, number> = {};
    let total = 0;
    for (const { plugin, weight } of this.plugins.values()) {
      const s = plugin.score(ctx, server);
      breakdown[plugin.id] = s;
      total += s * weight;
    }
    return { total, breakdown };
  }
}

/** Default global registry. Engine wires into this in a future phase. */
export const defaultRegistry = new PluginRegistry();
