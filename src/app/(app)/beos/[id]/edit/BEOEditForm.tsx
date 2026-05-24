"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, ArrowLeft, AlertCircle } from "lucide-react";

type BEOInput = {
  id: string;
  postAs: string;
  bookingId: string;
  uepaNumber: string;
  account: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  onsiteContact: string;
  cateringManager: string;
  managerId: string;
  locationId: string;
  roomId: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  expectedGuests: number;
  status: string;
  menu: string;
  av: string;
  setupNotes: string;
  specialInstructions: string;
  miscNotes: string;
  handwrittenChanges: string;
};

type LocationOpt = { id: string; name: string; code: string };
type ManagerOpt = { id: string; name: string; email: string };
type RoomOpt = { id: string; name: string; code: string; locationId: string };

const STATUSES = ["DRAFT", "CONFIRMED", "TENTATIVE", "CANCELLED", "COMPLETED"];

/**
 * Phase 11: client-side BEO edit form.
 *
 * Mirrors the create flow (`/beos/new`) but submits a PATCH so partial
 * updates work. On success we `router.refresh()` then push back to the
 * detail page so any board / schedule re-sync is visible.
 */
export default function BEOEditForm({
  beo,
  locations,
  managers,
  rooms,
}: {
  beo: BEOInput;
  locations: LocationOpt[];
  managers: ManagerOpt[];
  rooms: RoomOpt[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<BEOInput>(beo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof BEOInput>(key: K, value: BEOInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Filter rooms to the currently-selected location so users don't pair
  // a room with the wrong venue.
  const filteredRooms = rooms.filter((r) => !form.locationId || r.locationId === form.locationId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/beos/${beo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postAs: form.postAs,
        bookingId: form.bookingId,
        uepaNumber: form.uepaNumber,
        account: form.account,
        contactName: form.contactName,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        onsiteContact: form.onsiteContact,
        cateringManager: form.cateringManager,
        managerId: form.managerId,
        locationId: form.locationId,
        roomId: form.roomId,
        eventDate: form.eventDate,
        startTime: form.startTime,
        endTime: form.endTime,
        expectedGuests: Number(form.expectedGuests),
        status: form.status,
        menu: form.menu,
        av: form.av,
        setupNotes: form.setupNotes,
        specialInstructions: form.specialInstructions,
        miscNotes: form.miscNotes,
        handwrittenChanges: form.handwrittenChanges,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to save");
      return;
    }
    router.push(`/beos/${beo.id}`);
    router.refresh();
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href={`/beos/${beo.id}`} className="text-sm text-cardinal hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Back to BEO
          </Link>
          <h1 className="text-3xl mt-1">Edit BEO</h1>
          <p className="text-ink-muted text-sm">{beo.postAs} · {beo.bookingId || "—"}</p>
        </div>
        <select
          value={form.status}
          onChange={(e) => set("status", e.target.value)}
          className="input"
          aria-label="BEO status"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && (
        <div className="card p-3 border-2 border-cardinal/30 text-sm text-cardinal flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="card p-5 space-y-3">
          <h2 className="text-lg">Event</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Event Name (Post As)">
              <input className="input w-full" value={form.postAs} required
                onChange={(e) => set("postAs", e.target.value)} />
            </Field>
            <Field label="Booking ID">
              <input className="input w-full" value={form.bookingId} required
                onChange={(e) => set("bookingId", e.target.value)} />
            </Field>
            <Field label="BEO / UEPA #">
              <input className="input w-full" value={form.uepaNumber}
                onChange={(e) => set("uepaNumber", e.target.value)} />
            </Field>
            <Field label="Account">
              <input className="input w-full" value={form.account}
                onChange={(e) => set("account", e.target.value)} />
            </Field>
            <Field label="Date">
              <input type="date" className="input w-full" value={form.eventDate} required
                onChange={(e) => set("eventDate", e.target.value)} />
            </Field>
            <Field label="Guests">
              <input type="number" min={0} className="input w-full" value={form.expectedGuests}
                onChange={(e) => set("expectedGuests", Number(e.target.value))} />
            </Field>
            <Field label="Start time">
              <input type="time" className="input w-full" value={form.startTime}
                onChange={(e) => set("startTime", e.target.value)} />
            </Field>
            <Field label="End time">
              <input type="time" className="input w-full" value={form.endTime}
                onChange={(e) => set("endTime", e.target.value)} />
            </Field>
            <Field label="Venue">
              <select className="input w-full" value={form.locationId}
                onChange={(e) => set("locationId", e.target.value)}>
                <option value="">—</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
              </select>
            </Field>
            <Field label="Room">
              <select className="input w-full" value={form.roomId}
                onChange={(e) => set("roomId", e.target.value)}>
                <option value="">—</option>
                {filteredRooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
              </select>
            </Field>
            <Field label="Assigned Manager">
              <select className="input w-full" value={form.managerId}
                onChange={(e) => set("managerId", e.target.value)}>
                <option value="">— Unassigned —</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-lg">Contacts</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Catering Manager">
              <input className="input w-full" value={form.cateringManager}
                onChange={(e) => set("cateringManager", e.target.value)} />
            </Field>
            <Field label="Contact Name">
              <input className="input w-full" value={form.contactName}
                onChange={(e) => set("contactName", e.target.value)} />
            </Field>
            <Field label="Contact Email">
              <input type="email" className="input w-full" value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)} />
            </Field>
            <Field label="Contact Phone">
              <input className="input w-full" value={form.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)} />
            </Field>
            <Field label="On-site contact">
              <input className="input w-full" value={form.onsiteContact}
                onChange={(e) => set("onsiteContact", e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-lg">Menu / AV / Notes</h2>
          <Field label="Menu">
            <textarea className="input w-full" rows={3} value={form.menu}
              onChange={(e) => set("menu", e.target.value)} />
          </Field>
          <Field label="AV">
            <textarea className="input w-full" rows={2} value={form.av}
              onChange={(e) => set("av", e.target.value)} />
          </Field>
          <Field label="Setup Notes">
            <textarea className="input w-full" rows={3} value={form.setupNotes}
              onChange={(e) => set("setupNotes", e.target.value)} />
          </Field>
          <Field label="Special Instructions">
            <textarea className="input w-full" rows={3} value={form.specialInstructions}
              onChange={(e) => set("specialInstructions", e.target.value)} />
          </Field>
          <Field label="Miscellaneous Notes">
            <textarea className="input w-full" rows={2} value={form.miscNotes}
              onChange={(e) => set("miscNotes", e.target.value)} />
          </Field>
          <Field label="Handwritten Changes / Revisions">
            <textarea className="input w-full font-mono" rows={2} value={form.handwrittenChanges}
              onChange={(e) => set("handwrittenChanges", e.target.value)} />
          </Field>
        </section>

        <div className="flex justify-end gap-3">
          <Link href={`/beos/${beo.id}`} className="btn-ghost">Cancel</Link>
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={busy}>
            <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
