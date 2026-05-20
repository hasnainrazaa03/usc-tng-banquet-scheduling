import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/utils";
import GenerateForm from "./form";

export const dynamic = "force-dynamic";

export default async function GeneratePage() {
  const schedules = await prisma.schedule.findMany({
    orderBy: { weekStart: "desc" },
    include: { _count: { select: { shifts: true } } },
    take: 8,
  });
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl">Generate Schedule</h1>
        <p className="text-ink-muted">
          Run the AI-assisted scheduler. The engine filters by qualification, availability, and time-off,
          then prefers higher seniority and balances hours across the roster.
        </p>
      </div>

      <GenerateForm />

      <div className="card p-6">
        <h2 className="text-lg mb-3">Recent Schedules</h2>
        <ul className="divide-y divide-ink/5">
          {schedules.map((s) => (
            <li key={s.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-ink-muted">
                  {fmtDate(s.weekStart)} → {fmtDate(s.weekEnd)} · {s._count.shifts} shifts
                </div>
              </div>
              <div className="flex gap-2">
                <span className="pill bg-cardinal/10 text-cardinal">{s.status}</span>
                <Link href={`/schedule/board?id=${s.id}`} className="btn-outline">Open Board</Link>
                <Link href={`/schedule/print?id=${s.id}`} className="btn-ghost">Print</Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
