import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const locs = await prisma.location.findMany({ include: { rooms: true } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">Locations &amp; Rooms</h1>
        <p className="text-ink-muted">All venues, halls, and rooms used for banquet events.</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {locs.map((l) => (
          <div key={l.id} className="card p-6 space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-muted">{l.code}</div>
              <h2 className="text-2xl font-display">{l.name}</h2>
              <div className="text-sm text-ink-muted">{l.address ?? ""}</div>
            </div>
            <div className="border-t border-ink/5 pt-3">
              <div className="text-xs uppercase tracking-wider text-ink-muted mb-2">Rooms</div>
              <ul className="grid grid-cols-2 gap-2">
                {l.rooms.map((r) => (
                  <li key={r.id} className="bg-canvas-soft rounded-lg p-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-ink-muted">{r.code} · cap {r.capacity ?? "—"}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.setupTypes.map((s) => (
                        <span key={s} className="pill bg-cardinal/10 text-cardinal">{s}</span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
