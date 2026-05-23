import { prisma } from "@/lib/db";
import AvailabilityEditor, { type AvailabilityServer } from "./editor";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const rows = await prisma.server.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ seniority: { seniorityRank: "asc" } }],
    include: { availability: true, seniority: true },
  });
  const servers: AvailabilityServer[] = rows.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    rows: s.availability.map((a) => ({
      id: a.id,
      dayOfWeek: a.dayOfWeek as AvailabilityServer["rows"][number]["dayOfWeek"],
      startTime: a.startTime,
      endTime: a.endTime,
      preference: a.preference,
      notes: a.notes,
    })),
  }));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">Availability</h1>
        <p className="text-ink-muted">
          Default availability windows per server (HH:mm, 24-hour). Click any
          cell to edit. Empty cells are treated as unavailable that weekday by
          the auto-scheduler and the schedule board's server drawer.
        </p>
      </div>
      <AvailabilityEditor servers={servers} />
    </div>
  );
}
