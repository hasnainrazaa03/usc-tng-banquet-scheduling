/**
 * Seniority recalculation utilities.
 *
 * `recalculateAllSeniority` is used after any server edit that can change
 * the ranking (hireDate changes, hire/termination, new server creation).
 * It runs inside a Prisma transaction so the rank column is internally
 * consistent — no half-renumbered intermediate state is ever visible.
 */

import type { Prisma } from "@prisma/client";

/** Years between two dates, using 365.25 days per year. */
export function yearsBetween(from: Date, to: Date = new Date()): number {
  return (to.getTime() - from.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

/**
 * Recompute `yearsOfService`, `seniorityScore`, and `seniorityRank` across
 * every ACTIVE server. Rank is dense, 1-indexed, ordered by ascending
 * hireDate (oldest hire = rank 1). Servers without a `SeniorityRecord`
 * yet have one created.
 */
export async function recalculateAllSeniority(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
) {
  const servers = await tx.server.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ hireDate: "asc" }],
    select: { id: true, hireDate: true },
  });
  for (let i = 0; i < servers.length; i++) {
    const s = servers[i];
    const years = yearsBetween(s.hireDate, now);
    await tx.seniorityRecord.upsert({
      where: { serverId: s.id },
      create: {
        serverId: s.id,
        yearsOfService: years,
        seniorityScore: years,
        seniorityRank: i + 1,
      },
      update: {
        yearsOfService: years,
        seniorityScore: years,
        seniorityRank: i + 1,
      },
    });
  }
  return servers.length;
}
