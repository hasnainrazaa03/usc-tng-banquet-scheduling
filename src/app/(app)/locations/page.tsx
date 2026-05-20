import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  // VenueGroup -> Location -> Venue (Prisma model still named `Room` internally;
  // see docs/architecture/venue-hierarchy.md for the planned DB rename.)
  const groups = await prisma.venueGroup.findMany({
    orderBy: { name: "asc" },
    include: {
      locations: {
        orderBy: { name: "asc" },
        include: { rooms: { orderBy: { name: "asc" }, include: { spaces: true } } },
      },
    },
  });
  const orphanLocations = await prisma.location.findMany({
    where: { venueGroupId: null },
    include: { rooms: true },
  });
  const totalVenues = groups.reduce(
    (n, g) => n + g.locations.reduce((m, l) => m + l.rooms.length, 0),
    orphanLocations.reduce((m, l) => m + l.rooms.length, 0),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl">Venues</h1>
          <p className="text-ink-muted">
            All venue groups, locations, and event spaces operated by USC Private Events &amp; Conferences.
          </p>
        </div>
        <div className="text-xs text-ink-muted">
          <span className="pill-muted">{groups.length} venue groups</span>{" "}
          <span className="pill-muted">{groups.reduce((n, g) => n + g.locations.length, 0) + orphanLocations.length} locations</span>{" "}
          <span className="pill-muted">{totalVenues} venues</span>
        </div>
      </div>

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.id} className="space-y-3">
            <header className="flex items-baseline gap-3">
              <span className="pill-cardinal font-mono">{g.code}</span>
              <h2 className="text-2xl font-display">{g.name}</h2>
              {g.shortName && g.shortName !== g.name && (
                <span className="text-xs text-ink-muted">({g.shortName})</span>
              )}
            </header>
            <div className="grid lg:grid-cols-2 gap-4">
              {g.locations.map((l) => (
                <div key={l.id} className="card-hover p-6 space-y-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-ink-muted">{l.code}</div>
                    <h3 className="text-xl font-display">{l.name}</h3>
                    {l.address && <div className="text-sm text-ink-muted">{l.address}</div>}
                  </div>
                  <div className="border-t border-ink/5 pt-3">
                    <div className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                      Venues ({l.rooms.length})
                    </div>
                    {l.rooms.length === 0 ? (
                      <div className="text-sm text-ink-muted italic">No venues configured yet.</div>
                    ) : (
                      <ul className="grid sm:grid-cols-2 gap-2">
                        {l.rooms.map((r) => (
                          <li key={r.id} className="bg-canvas-soft rounded-lg p-3">
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-ink-muted">
                              {r.code} · cap {r.capacity ?? "—"}
                              {r.spaces.length > 0 && ` · ${r.spaces.length} space${r.spaces.length === 1 ? "" : "s"}`}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {r.setupTypes.map((s) => (
                                <span key={s} className="pill bg-cardinal/10 text-cardinal">{s}</span>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
              {g.locations.length === 0 && (
                <div className="card p-6 text-sm text-ink-muted italic col-span-full">
                  No locations configured for this venue group yet.
                </div>
              )}
            </div>
          </section>
        ))}

        {orphanLocations.length > 0 && (
          <section className="space-y-3">
            <header className="flex items-baseline gap-3">
              <span className="pill-muted font-mono">UNGROUPED</span>
              <h2 className="text-2xl font-display">Other Locations</h2>
            </header>
            <div className="grid lg:grid-cols-2 gap-4">
              {orphanLocations.map((l) => (
                <div key={l.id} className="card p-6 space-y-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-ink-muted">{l.code}</div>
                    <h3 className="text-xl font-display">{l.name}</h3>
                  </div>
                  <div className="text-xs uppercase tracking-wider text-ink-muted">
                    Venues ({l.rooms.length})
                  </div>
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {l.rooms.map((r) => (
                      <li key={r.id} className="bg-canvas-soft rounded-lg p-3 text-sm">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-ink-muted">{r.code}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
