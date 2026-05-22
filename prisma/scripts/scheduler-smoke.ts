/**
 * Quick smoke test for the auto-scheduler against the current week's
 * synthetic data. Run with:
 *
 *   npx tsx prisma/scripts/scheduler-smoke.ts
 *
 * Prints per-schedule fill/unfill counts and the most common rejection
 * reasons so we can sanity-check that fill-unassigned works after the
 * Phase 5.1 data + role normalisation changes.
 */
import { PrismaClient } from "@prisma/client";
import { clearUnlockedAssignments, runAutoSchedule } from "../../src/lib/scheduling-engine";
import { startOfOperationalWeek } from "../../src/lib/week-config";

const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  const ws = startOfOperationalWeek(today);
  const nws = new Date(ws);
  nws.setDate(nws.getDate() + 7);

  for (const weekStart of [ws, nws]) {
    const schedule = await prisma.schedule.findFirst({ where: { weekStart } });
    if (!schedule) {
      console.log(`No schedule found for week starting ${weekStart.toISOString().slice(0, 10)}`);
      continue;
    }
    console.log(`\n══ Week of ${weekStart.toISOString().slice(0, 10)} (schedule ${schedule.id}) ══`);

    // Count shifts and pre-existing assignments.
    const shifts = await prisma.shift.findMany({
      where: { scheduleId: schedule.id },
      include: { requirements: true, assignments: true },
    });
    const required = shifts.reduce((s, sh) => s + sh.requirements.reduce((t, r) => t + r.count, 0), 0);
    console.log(`  shifts:        ${shifts.length}`);
    console.log(`  total slots:   ${required}`);

    // Clear and re-run to test the full fill-unassigned path.
    await clearUnlockedAssignments(schedule.id);
    const result = await runAutoSchedule({ scheduleId: schedule.id });
    console.log(`  filled:        ${result.filled}`);
    console.log(`  unfilled:      ${result.unfilled}`);

    // Top rejection reasons.
    const reasonCounts = new Map<string, number>();
    for (const d of result.decisions ?? []) {
      for (const r of d.rejected ?? []) {
        reasonCounts.set(r.reason, (reasonCounts.get(r.reason) ?? 0) + 1);
      }
    }
    const top = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (top.length) {
      console.log("  top rejection reasons:");
      for (const [r, c] of top) console.log(`    ${c.toString().padStart(4)} × ${r}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
