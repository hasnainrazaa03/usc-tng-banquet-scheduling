import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDate, fmtTime } from "@/lib/utils";
import { Plus, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BEOListPage() {
  const beos = await prisma.bEO.findMany({
    orderBy: { eventDate: "asc" },
    include: { location: true, sections: true },
  });
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl">Banquet Event Orders</h1>
          <p className="text-ink-muted">All confirmed, tentative, and draft BEOs.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/beos/new" className="btn-primary"><Plus className="h-4 w-4" />New BEO</Link>
          <Link href="/beos/import" className="btn-outline"><Upload className="h-4 w-4" />Import</Link>
          <a href="/api/export?kind=beos" className="btn-outline">Export CSV</a>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm table-zebra">
          <thead className="bg-canvas-soft">
            <tr className="text-left text-xs uppercase tracking-wider text-ink-muted">
              <th className="px-4 py-3">BEO #</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Guests</th>
              <th className="px-4 py-3">Sections</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {beos.map((b) => (
              <tr key={b.id} className="border-t border-ink/5 hover:bg-canvas-soft/60">
                <td className="px-4 py-3 font-mono text-base font-semibold text-cardinal">
                  {b.beoNumber ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/beos/${b.id}`} className="font-medium hover:underline">{b.postAs}</Link>
                  <div className="text-xs text-ink-muted">{b.account ?? "—"} · {b.bookingId ?? "—"}</div>
                </td>
                <td className="px-4 py-3">{fmtDate(b.eventDate)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{fmtTime(b.startTime)} – {fmtTime(b.endTime)}</td>
                <td className="px-4 py-3">{b.location?.name ?? "—"}</td>
                <td className="px-4 py-3">{b.expectedGuests ?? "—"}</td>
                <td className="px-4 py-3">{b.sections.length}</td>
                <td className="px-4 py-3"><span className="pill bg-cardinal/10 text-cardinal">{b.status}</span></td>
              </tr>
            ))}
            {beos.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-ink-muted">No BEOs yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
