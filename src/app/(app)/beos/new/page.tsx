"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, FileType, Image as ImageIcon, ClipboardList, Sparkles, Loader2, X } from "lucide-react";
import { parsePdfFile, parsePngFile } from "@/lib/import/parse-files-client";

type Tab = "form" | "text" | "pdf" | "png";

type RoomOption = { id: string; code: string; name: string };
type LocationOption = { id: string; code: string; name: string; rooms: RoomOption[] };
type ManagerOption = { id: string; name: string; email: string; role: string };
type Options = { locations: LocationOption[]; managers: ManagerOption[] };

type FormState = {
  // Required
  beoNumber: string;
  postAs: string;
  bookingId: string;
  eventDate: string;
  locationId: string;
  startTime: string;
  endTime: string;
  expectedGuests: number;
  managerId: string;
  // Optional
  roomId: string;
  account: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  onsiteContact: string;
  cateringManager: string;
  menu: string;
  av: string;
  specialInstructions: string;
  miscNotes: string;
  handwrittenChanges: string;
  setupNotes: string;
};

const EMPTY: FormState = {
  beoNumber: "",
  postAs: "",
  bookingId: "",
  eventDate: new Date().toISOString().slice(0, 10),
  locationId: "",
  startTime: "17:00",
  endTime: "22:00",
  expectedGuests: 100,
  managerId: "",
  roomId: "",
  account: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  onsiteContact: "",
  cateringManager: "",
  menu: "",
  av: "",
  specialInstructions: "",
  miscNotes: "",
  handwrittenChanges: "",
  setupNotes: "",
};

export default function BEONewPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("form");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);
  const [importWarning, setImportWarning] = useState<string | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/options")
      .then((r) => r.json())
      .then(setOptions)
      .catch(() => setOptions({ locations: [], managers: [] }));
  }, []);

  function up<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((s) => {
      // When the user changes the venue, clear the room so we don't leave a
      // dangling FK from a different venue's room list.
      if (k === "locationId" && v !== s.locationId) {
        return { ...s, [k]: v, roomId: "" };
      }
      return { ...s, [k]: v };
    });
  }

  /** Merge parser results into the form, keeping existing user edits when
   *  the parser couldn't find a field. Resolves parser-returned venue/room
   *  codes against the live /api/options lookup. */
  function applyExtracted(extracted: Record<string, unknown>, source: string) {
    setForm((s) => {
      // Resolve venueCode → locationId, and (if any) a room code in the same
      // location.
      let locationId = s.locationId;
      let roomId = s.roomId;
      const venueCode = (extracted.venueCode as string | undefined)?.trim();
      if (venueCode && options) {
        // Direct location code match
        const locByCode = options.locations.find((l) => l.code === venueCode);
        if (locByCode) {
          locationId = locByCode.id;
          roomId = "";
        } else {
          // Maybe it's a room code — find the parent location and set the room
          for (const loc of options.locations) {
            const room = loc.rooms.find((r) => r.code === venueCode);
            if (room) {
              locationId = loc.id;
              roomId = room.id;
              break;
            }
          }
        }
      }
      return {
        ...s,
        beoNumber: (extracted.beoNumber as string) || (extracted.uepaNumber as string) || s.beoNumber,
        postAs: (extracted.postAs as string) || s.postAs,
        account: (extracted.account as string) || s.account,
        bookingId: (extracted.bookingId as string) || s.bookingId,
        eventDate: (extracted.eventDate as string) || s.eventDate,
        startTime: (extracted.startTime as string) || s.startTime,
        endTime: (extracted.endTime as string) || s.endTime,
        expectedGuests: (extracted.expectedGuests as number) || s.expectedGuests,
        locationId,
        roomId,
        setupNotes: (extracted.setupNotes as string) || s.setupNotes,
        menu: (extracted.menu as string) || s.menu,
        av: (extracted.av as string) || s.av,
        specialInstructions: (extracted.specialInstructions as string) || (extracted.notes as string) || s.specialInstructions,
        miscNotes: (extracted.miscNotes as string) || s.miscNotes,
        handwrittenChanges: (extracted.handwrittenChanges as string) || s.handwrittenChanges,
        contactName: (extracted.contactName as string) || s.contactName,
        contactEmail: (extracted.contactEmail as string) || s.contactEmail,
        contactPhone: (extracted.contactPhone as string) || s.contactPhone,
        onsiteContact: (extracted.onsiteContact as string) || s.onsiteContact,
        cateringManager: (extracted.cateringManager as string) || s.cateringManager,
      };
    });
    setImportedFrom(source);
    const confidence = typeof extracted.confidence === "number" ? extracted.confidence : 1;
    setImportWarning(
      confidence < 0.5
        ? "Low confidence — the parser only recognised a few fields. Please review every field carefully."
        : null,
    );
    setTab("form");
  }

  async function parseText(text: string, source: string) {
    if (!text.trim()) throw new Error("Nothing to parse — input is empty.");
    const res = await fetch("/api/beos/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Parse failed (${res.status})`);
    const { extracted } = await res.json();
    applyExtracted(extracted, source);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSubmitError(null);
    const res = await fetch("/api/beos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const j = await res.json();
      router.push(`/beos/${j.id}`);
    } else {
      const err = await res.json().catch(() => ({}));
      setSubmitError(
        err.missing?.length
          ? `Missing required field${err.missing.length === 1 ? "" : "s"}: ${err.missing.join(", ")}`
          : err.error || `Save failed (${res.status})`,
      );
    }
  }

  function clearImport() {
    setForm(EMPTY);
    setImportedFrom(null);
    setImportWarning(null);
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-4xl">New BEO</h1>
        <p className="text-ink-muted">
          Enter manually, paste raw text, or import a PDF / image. The parser pre-fills the form so
          you can review and edit before saving.
        </p>
      </div>

      <div className="card p-0 overflow-hidden">
        <nav className="flex border-b border-ink/5 bg-canvas-soft/40">
          <TabBtn active={tab === "form"} onClick={() => setTab("form")} icon={<ClipboardList className="h-4 w-4" />}>
            Form
          </TabBtn>
          <TabBtn active={tab === "text"} onClick={() => setTab("text")} icon={<FileText className="h-4 w-4" />}>
            Text
          </TabBtn>
          <TabBtn active={tab === "pdf"} onClick={() => setTab("pdf")} icon={<FileType className="h-4 w-4" />}>
            PDF
          </TabBtn>
          <TabBtn active={tab === "png"} onClick={() => setTab("png")} icon={<ImageIcon className="h-4 w-4" />}>
            PNG / Image
          </TabBtn>
        </nav>

        <div className="p-6">
          {tab === "form" && (
            <FormTab
              form={form}
              up={up}
              submit={submit}
              saving={saving}
              importedFrom={importedFrom}
              importWarning={importWarning}
              onClearImport={clearImport}
              onCancel={() => router.back()}
              options={options}
              submitError={submitError}
            />
          )}
          {tab === "text" && <TextTab onParse={(t) => parseText(t, "Text")} />}
          {tab === "pdf" && <PdfTab onParse={(t) => parseText(t, "PDF")} />}
          {tab === "png" && <PngTab onParse={(t) => parseText(t, "PNG")} />}
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors " +
        (active
          ? "border-cardinal text-cardinal bg-white"
          : "border-transparent text-ink-muted hover:text-ink hover:bg-canvas-soft/60")
      }
    >
      {icon}
      {children}
    </button>
  );
}

// ─── Form tab ────────────────────────────────────────────────────────────
function FormTab({
  form,
  up,
  submit,
  saving,
  importedFrom,
  importWarning,
  onClearImport,
  onCancel,
  options,
  submitError,
}: {
  form: FormState;
  up: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  submit: (e: React.FormEvent) => void;
  saving: boolean;
  importedFrom: string | null;
  importWarning: string | null;
  onClearImport: () => void;
  onCancel: () => void;
  options: Options | null;
  submitError: string | null;
}) {
  const selectedLocation = options?.locations.find((l) => l.id === form.locationId) ?? null;
  const roomOptions = selectedLocation?.rooms ?? [];

  return (
    <form onSubmit={submit} className="space-y-4">
      {importedFrom && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-cardinal/20 bg-cardinal/5 px-4 py-3 text-sm">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 mt-0.5 text-cardinal" />
            <div>
              <div className="font-medium text-cardinal">Imported from {importedFrom}</div>
              <div className="text-ink-muted">Review every field carefully before saving.</div>
              {importWarning && <div className="mt-1 text-amber-700">{importWarning}</div>}
            </div>
          </div>
          <button type="button" onClick={onClearImport} className="text-ink-muted hover:text-ink" title="Clear imported data">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {submitError && (
        <div className="rounded-lg border border-cardinal/30 bg-cardinal/10 px-4 py-3 text-sm text-cardinal">
          {submitError}
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-xs uppercase tracking-wide text-ink-muted font-semibold">
          Required fields <span className="text-cardinal">*</span>
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">BEO Number <Req /></label>
            <input
              className="input"
              value={form.beoNumber}
              onChange={(e) => up("beoNumber", e.target.value)}
              placeholder="BEO-2026-1234"
              required
            />
          </div>
          <div>
            <label className="label">Booking ID <Req /></label>
            <input
              className="input"
              value={form.bookingId}
              onChange={(e) => up("bookingId", e.target.value)}
              placeholder="BK-2026-1234"
              required
            />
          </div>
          <div className="col-span-2">
            <label className="label">Event Name (Post As) <Req /></label>
            <input className="input" value={form.postAs} onChange={(e) => up("postAs", e.target.value)} required />
          </div>
          <div>
            <label className="label">Event Date <Req /></label>
            <input
              className="input"
              type="date"
              value={form.eventDate}
              onChange={(e) => up("eventDate", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Expected Guests <Req /></label>
            <input
              className="input"
              type="number"
              min={1}
              value={form.expectedGuests}
              onChange={(e) => up("expectedGuests", parseInt(e.target.value) || 0)}
              required
            />
          </div>
          <div>
            <label className="label">Start Time <Req /></label>
            <input
              className="input"
              type="time"
              value={form.startTime}
              onChange={(e) => up("startTime", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">End Time <Req /></label>
            <input
              className="input"
              type="time"
              value={form.endTime}
              onChange={(e) => up("endTime", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Venue <Req /></label>
            <select
              className="input"
              value={form.locationId}
              onChange={(e) => up("locationId", e.target.value)}
              required
            >
              <option value="">— Select a venue —</option>
              {options?.locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Room / Sub-venue <span className="text-ink-muted text-xs">(optional)</span></label>
            <select
              className="input"
              value={form.roomId}
              onChange={(e) => up("roomId", e.target.value)}
              disabled={!form.locationId}
            >
              <option value="">{form.locationId ? "— Any room —" : "Select a venue first"}</option>
              {roomOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Manager <Req /></label>
            <select
              className="input"
              value={form.managerId}
              onChange={(e) => up("managerId", e.target.value)}
              required
            >
              <option value="">— Assign a manager —</option>
              {options?.managers.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-2 pt-2">
        <legend className="text-xs uppercase tracking-wide text-ink-muted font-semibold">
          Optional details
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Account / Client</label>
            <input className="input" value={form.account} onChange={(e) => up("account", e.target.value)} />
          </div>
          <div>
            <label className="label">Catering Manager (notes)</label>
            <input className="input" value={form.cateringManager} onChange={(e) => up("cateringManager", e.target.value)} />
          </div>
          <div>
            <label className="label">Contact Name</label>
            <input className="input" value={form.contactName} onChange={(e) => up("contactName", e.target.value)} />
          </div>
          <div>
            <label className="label">On-Site Contact</label>
            <input className="input" value={form.onsiteContact} onChange={(e) => up("onsiteContact", e.target.value)} />
          </div>
          <div>
            <label className="label">Contact Email</label>
            <input className="input" type="email" value={form.contactEmail} onChange={(e) => up("contactEmail", e.target.value)} />
          </div>
          <div>
            <label className="label">Contact Phone</label>
            <input className="input" value={form.contactPhone} onChange={(e) => up("contactPhone", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Menu Details</label>
            <textarea className="input" rows={3} value={form.menu} onChange={(e) => up("menu", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">A/V Details</label>
            <textarea className="input" rows={2} value={form.av} onChange={(e) => up("av", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Special Instructions</label>
            <textarea
              className="input"
              rows={2}
              value={form.specialInstructions}
              onChange={(e) => up("specialInstructions", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className="label">Miscellaneous Notes</label>
            <textarea
              className="input"
              rows={2}
              value={form.miscNotes}
              onChange={(e) => up("miscNotes", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className="label">Revised / Handwritten Changes</label>
            <textarea
              className="input"
              rows={2}
              value={form.handwrittenChanges}
              onChange={(e) => up("handwrittenChanges", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className="label">Staffing Notes</label>
            <textarea
              className="input"
              rows={2}
              value={form.setupNotes}
              onChange={(e) => up("setupNotes", e.target.value)}
              placeholder="e.g. 1 server per 25 guests, captain on call for VIP table"
            />
          </div>
        </div>
      </fieldset>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Create BEO"}</button>
      </div>
    </form>
  );
}

function Req() {
  return <span className="text-cardinal" title="Required">*</span>;
}

// ─── Text tab ────────────────────────────────────────────────────────────
function TextTab({ onParse }: { onParse: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await onParse(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="label">Paste raw BEO text</label>
      <textarea
        className="input font-mono text-xs h-80"
        placeholder={"Post As: USC Dornsife Gala\nAccount: USC Dornsife College\nBooking ID: BK-2026-1042\nEvent Date: 2026-05-21\nVenue: Town & Gown\nStart Time: 17:00\nEnd Time: 22:30\nGuests: 220\nSetup: Rounds of 10, head table for 12\nMenu: Plated 3-course\nA/V: 2 wireless mics, projector"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <div className="text-sm text-cardinal">{error}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn-primary" disabled={busy || !text.trim()} onClick={go}>
          {busy ? (<><Loader2 className="h-4 w-4 animate-spin" />Parsing…</>) : (<><Sparkles className="h-4 w-4" />Parse &amp; fill form</>)}
        </button>
      </div>
    </div>
  );
}

// ─── PDF tab ─────────────────────────────────────────────────────────────
function PdfTab({ onParse }: { onParse: (text: string) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function go() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress("Extracting text from PDF…");
    try {
      const { text, pageCount } = await parsePdfFile(file);
      setProgress(`Extracted ${pageCount} page${pageCount === 1 ? "" : "s"} — parsing fields…`);
      if (!text.trim()) throw new Error("No text found in PDF. Try the image tab if this is a scanned PDF.");
      await onParse(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-3">
      <label className="label">Upload BEO PDF</label>
      <input
        className="input"
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {file && <div className="text-xs text-ink-muted">Selected: {file.name} ({Math.round(file.size / 1024)} KB)</div>}
      {progress && <div className="text-sm text-ink-muted flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{progress}</div>}
      {error && <div className="text-sm text-cardinal">{error}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn-primary" disabled={busy || !file} onClick={go}>
          {busy ? "Parsing…" : (<><Sparkles className="h-4 w-4" />Parse PDF</>)}
        </button>
      </div>
      <p className="text-xs text-ink-muted">
        Works best with text-based PDFs (exported from Word, Caterease, etc.). Scanned PDFs should
        use the PNG / Image tab instead.
      </p>
    </div>
  );
}

// ─── PNG tab ─────────────────────────────────────────────────────────────
function PngTab({ onParse }: { onParse: (text: string) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ ratio: number; status: string } | null>(null);

  async function go() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress({ ratio: 0, status: "Loading OCR engine…" });
    try {
      const text = await parsePngFile(file, (p) => setProgress(p));
      if (!text.trim()) throw new Error("OCR returned no text. Try a higher-resolution image.");
      await onParse(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-3">
      <label className="label">Upload BEO image (PNG, JPG, or WEBP)</label>
      <input
        className="input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {file && <div className="text-xs text-ink-muted">Selected: {file.name} ({Math.round(file.size / 1024)} KB)</div>}
      {progress && (
        <div className="space-y-1">
          <div className="text-sm text-ink-muted flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {progress.status} ({Math.round(progress.ratio * 100)}%)
          </div>
          <div className="h-1.5 w-full bg-canvas-soft rounded-full overflow-hidden">
            <div className="h-full bg-cardinal transition-all" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
          </div>
        </div>
      )}
      {error && <div className="text-sm text-cardinal">{error}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn-primary" disabled={busy || !file} onClick={go}>
          {busy ? "Parsing…" : (<><Sparkles className="h-4 w-4" />Parse image</>)}
        </button>
      </div>
      <p className="text-xs text-ink-muted">
        Uses Tesseract.js OCR (~10 MB engine cached after first use). Works best on clear,
        high-resolution scans or screenshots.
      </p>
    </div>
  );
}
