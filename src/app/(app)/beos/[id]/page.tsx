import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fmtDate, fmtTime } from "@/lib/utils";
import { Pencil } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BEODetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const canEdit = session?.role === "ADMIN" || session?.role === "MANAGER";

  const beo = await prisma.bEO.findUnique({
    where: { id: params.id },
    include: { location: true, sections: true, events: true },
  });
  if (!beo) notFound();

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/beos" className="text-sm text-cardinal hover:underline">← All BEOs</Link>
          <h1 className="text-4xl mt-1">{beo.postAs}</h1>
          <p className="text-ink-muted">
            {beo.account ?? "—"} · {beo.bookingId ?? "—"} {beo.uepaNumber ? `· UEPA ${beo.uepaNumber}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="pill bg-cardinal text-white px-3 py-1">{beo.status}</span>
          {canEdit && (
            <Link
              href={`/beos/${beo.id}/edit`}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Pencil className="h-4 w-4" /> Edit BEO
            </Link>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-6 space-y-3">
          <h2 className="text-lg">Event</h2>
          <Field label="Date" value={fmtDate(beo.eventDate)} />
          <Field label="Time" value={`${fmtTime(beo.startTime)} – ${fmtTime(beo.endTime)}`} />
          <Field label="Location" value={beo.location?.name ?? "—"} />
          <Field label="Guests" value={String(beo.expectedGuests ?? "—")} />
          <Field label="Revision" value={beo.revisionDate ? fmtDate(beo.revisionDate) : "—"} />
        </div>
        <div className="card p-6 space-y-3">
          <h2 className="text-lg">Contacts</h2>
          <Field label="Catering Manager" value={beo.cateringManager ?? "—"} />
          <Field label="Contact" value={beo.contactName ?? "—"} />
          <Field label="Phone" value={beo.contactPhone ?? "—"} />
          <Field label="Email" value={beo.contactEmail ?? "—"} />
          <Field label="On-site" value={beo.onsiteContact ?? "—"} />
        </div>
        <div className="card p-6 space-y-3">
          <h2 className="text-lg">Billing</h2>
          <Field label="Method" value={beo.billingMethod ?? "—"} />
          <Field label="Account" value={beo.account ?? "—"} />
          <Field label="Booking ID" value={beo.bookingId ?? "—"} />
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg mb-3">Functions / Sections</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas-soft text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">Section</th>
                <th className="px-3 py-2 text-left">Function</th>
                <th className="px-3 py-2 text-left">Venue</th>
                <th className="px-3 py-2 text-left">Setup</th>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Guests</th>
                <th className="px-3 py-2 text-left">Staffing</th>
              </tr>
            </thead>
            <tbody>
              {beo.sections.map((s) => (
                <tr key={s.id} className="border-t border-ink/5">
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2">{s.functionType ?? "—"}</td>
                  <td className="px-3 py-2">{s.roomCode ?? "—"}</td>
                  <td className="px-3 py-2">{s.setupType ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtTime(s.startTime)} – {fmtTime(s.endTime)}</td>
                  <td className="px-3 py-2">{s.guests ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(s.staffingNeeds) && (s.staffingNeeds as any[]).map((n, i) => (
                        <span key={i} className="pill bg-cardinal/10 text-cardinal">{n.count}× {n.roleCode}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg mb-2">Menu</h2>
          <pre className="text-xs whitespace-pre-wrap bg-canvas-soft p-3 rounded-lg">{JSON.stringify(beo.menu ?? {}, null, 2)}</pre>
        </div>
        <div className="card p-6">
          <h2 className="text-lg mb-2">AV</h2>
          <pre className="text-xs whitespace-pre-wrap bg-canvas-soft p-3 rounded-lg">{JSON.stringify(beo.av ?? {}, null, 2)}</pre>
        </div>
        <div className="card p-6">
          <h2 className="text-lg mb-2">Setup Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{beo.setupNotes ?? "—"}</p>
        </div>
        <div className="card p-6">
          <h2 className="text-lg mb-2">Special Instructions</h2>
          <p className="text-sm whitespace-pre-wrap">{beo.specialInstructions ?? "—"}</p>
        </div>
        <div className="card p-6">
          <h2 className="text-lg mb-2">Miscellaneous Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{beo.miscNotes ?? "—"}</p>
        </div>
        <div className="card p-6 border-2 border-dashed border-cardinal/30">
          <h2 className="text-lg mb-2">Handwritten Changes / Revisions</h2>
          <p className="text-sm font-mono whitespace-pre-wrap">{beo.handwrittenChanges ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
