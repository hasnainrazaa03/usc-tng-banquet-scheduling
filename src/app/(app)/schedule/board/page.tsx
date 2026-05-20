import { prisma } from "@/lib/db";
import ScheduleBoard from "./board";

export const dynamic = "force-dynamic";

export default async function ScheduleBoardPage({ searchParams }: { searchParams: { id?: string } }) {
  const schedule = searchParams.id
    ? await prisma.schedule.findUnique({ where: { id: searchParams.id } })
    : await prisma.schedule.findFirst({ orderBy: { weekStart: "desc" } });

  if (!schedule) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-display mb-2">No schedule found</h1>
        <p className="text-ink-muted">Generate one first from the Generate Schedule page.</p>
      </div>
    );
  }

  const [shifts, servers] = await Promise.all([
    prisma.shift.findMany({
      where: { scheduleId: schedule.id },
      orderBy: [{ date: "asc" }, { startsAt: "asc" }],
      include: {
        requirements: { include: { role: true } },
        assignments: { include: { server: true } },
        event: true,
      },
    }),
    prisma.server.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ seniority: { seniorityRank: "asc" } }],
      include: { seniority: true, qualifications: { include: { qualification: true } } },
    }),
  ]);

  // Serialize Date instances for client
  const serialized = JSON.parse(JSON.stringify({ schedule, shifts, servers }));
  return <ScheduleBoard data={serialized} />;
}
