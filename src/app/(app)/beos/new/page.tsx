"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BEONewPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    postAs: "",
    account: "",
    bookingId: "",
    eventDate: new Date().toISOString().slice(0, 10),
    startTime: "17:00",
    endTime: "22:00",
    expectedGuests: 100,
    locationCode: "TNG",
    setupNotes: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/beos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const j = await res.json();
      router.push(`/beos/${j.id}`);
    }
  }

  function up<K extends keyof typeof form>(k: K, v: any) { setForm((s) => ({ ...s, [k]: v })); }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-4xl">New BEO</h1>
      <form onSubmit={submit} className="card p-6 grid grid-cols-2 gap-4">
        <div className="col-span-2"><label className="label">Post As / Event Name</label><input className="input" value={form.postAs} onChange={(e) => up("postAs", e.target.value)} required /></div>
        <div><label className="label">Account / Client</label><input className="input" value={form.account} onChange={(e) => up("account", e.target.value)} /></div>
        <div><label className="label">Booking ID</label><input className="input" value={form.bookingId} onChange={(e) => up("bookingId", e.target.value)} /></div>
        <div><label className="label">Event Date</label><input className="input" type="date" value={form.eventDate} onChange={(e) => up("eventDate", e.target.value)} required /></div>
        <div><label className="label">Location Code</label><input className="input" value={form.locationCode} onChange={(e) => up("locationCode", e.target.value)} /></div>
        <div><label className="label">Start Time</label><input className="input" type="time" value={form.startTime} onChange={(e) => up("startTime", e.target.value)} /></div>
        <div><label className="label">End Time</label><input className="input" type="time" value={form.endTime} onChange={(e) => up("endTime", e.target.value)} /></div>
        <div><label className="label">Expected Guests</label><input className="input" type="number" value={form.expectedGuests} onChange={(e) => up("expectedGuests", parseInt(e.target.value) || 0)} /></div>
        <div className="col-span-2"><label className="label">Setup Notes</label><textarea className="input" rows={3} value={form.setupNotes} onChange={(e) => up("setupNotes", e.target.value)} /></div>
        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
          <button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Create BEO"}</button>
        </div>
      </form>
    </div>
  );
}
