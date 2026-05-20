import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDate, fmtTime } from "@/lib/utils";
import { ClipboardList, Users, CalendarClock, GanttChartSquare, Wand2, Printer } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const in14 = new Date(now); in14.setDate(in14.getDate() + 14);

  const [beoCount, serverCount, openTimeOff, upcomingBEOs, latestSchedule, openShifts] = await Promise.all([
    prisma.bEO.count(),
    prisma.server.count({ where: { status: "ACTIVE" } }),
    prisma.timeOffRequest.count({ where: { status: "PENDING" } }),
    prisma.bEO.findMany({
      where: { eventDate: { gte: now, lte: in14 } },
      orderBy: { eventDate: "asc" },
      take: 6,
      include: { location: true },
    }),
    prisma.schedule.findFirst({ orderBy: { weekStart: "desc" } }),
    prisma.shift.count({ where: { assignments: { none: {} }, statusCode: "NONE" } }),
  ]);

  const stats = [
    { label: "Active Servers", value: serverCount, icon: Users, href: "/servers" },
    { label: "BEOs on File", value: beoCount, icon: ClipboardList, href: "/beos" },
    { label: "Open Time-Off", value: openTimeOff, icon: CalendarClock, href: "/time-off" },
    { label: "Unfilled Shifts", value: openShifts, icon: GanttChartSquare, href: "/schedule/board" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl">Operations Dashboard</h1>
          <p className="text-ink-muted">Today is {fmtDate(now)} · USC Private Events &amp; Conferences</p>
        </div>
        <div className="flex gap-2">
          <Link href="/schedule/generate" className="btn-primary"><Wand2 className="h-4 w-4" />Generate Schedule</Link>
          <Link href="/schedule/print" className="btn-outline"><Printer className="h-4 w-4" />Print Weekly</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href} className="card p-5 hover:shadow-lg transition group">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-ink-muted">{s.label}</div>
                  <div className="text-3xl font-display mt-1">{s.value}</div>
                </div>
                <div className="h-10 w-10 rounded-lg bg-cardinal/10 text-cardinal grid place-items-center group-hover:bg-cardinal group-hover:text-white transition">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl">Upcoming Events (next 14 days)</h2>
            <Link href="/beos" className="text-sm text-cardinal hover:underline">All BEOs →</Link>
          </div>
          {upcomingBEOs.length === 0 && <div className="text-sm text-ink-muted">No events scheduled.</div>}
          <ul className="divide-y divide-ink/5">
            {upcomingBEOs.map((b) => (
              <li key={b.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Link href={`/beos/${b.id}`} className="font-medium hover:underline">{b.postAs}</Link>
                  <div className="text-xs text-ink-muted">
                    {fmtDate(b.eventDate)} · {fmtTime(b.startTime)}–{fmtTime(b.endTime)} · {b.location?.name ?? "—"}
                  </div>
                </div>
                <span className="pill bg-cardinal/10 text-cardinal">{b.status}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-xl">Latest Schedule</h2>
          {latestSchedule ? (
            <div className="space-y-2">
              <div className="font-medium">{latestSchedule.name}</div>
              <div className="text-xs text-ink-muted">
                {fmtDate(latestSchedule.weekStart)} → {fmtDate(latestSchedule.weekEnd)}
              </div>
              <span className="pill bg-gold-100 text-gold-900 border border-gold-200">{latestSchedule.status}</span>
              <div className="pt-2 flex flex-col gap-2">
                <Link href={`/schedule/board?id=${latestSchedule.id}`} className="btn-outline">Open Board</Link>
                <Link href={`/schedule/print?id=${latestSchedule.id}`} className="btn-ghost">Print View</Link>
              </div>
            </div>
          ) : (
            <div className="text-sm text-ink-muted">No schedule yet. Generate one to begin.</div>
          )}
        </div>
      </div>
    </div>
  );
}
