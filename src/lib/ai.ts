/**
 * Lightweight AI helpers for the banquet system.
 *
 * If OPENAI_API_KEY is present, calls the OpenAI Responses API for
 * extraction/explanation. Otherwise, falls back to a deterministic
 * pattern-match parser using `banquet_master_data.json`.
 */

import fs from "node:fs";
import path from "node:path";

let MASTER: any | null = null;
function master() {
  if (MASTER) return MASTER;
  try {
    MASTER = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "banquet_master_data.json"), "utf-8"));
  } catch { MASTER = { commonPatterns: [], staffingRules: { serversPerGuests: {} } }; }
  return MASTER;
}

export type StaffingNeed = { roleCode: string; count: number; note?: string };

export function deriveStaffingFromGuests(opts: {
  guests: number;
  type?: string;          // "PLATED_DINNER", "RECEPTION", etc.
  locationCode?: string;
  roomCode?: string;
}): StaffingNeed[] {
  const m = master();
  const rules = m.staffingRules ?? { serversPerGuests: {}, captainPerServers: 8, bartenderPerGuests: 75 };

  // Try pattern match first
  if (opts.locationCode || opts.roomCode || opts.type) {
    const match = (m.commonPatterns ?? []).find((p: any) => {
      const cond = p.match ?? {};
      if (cond.locationCode && cond.locationCode !== opts.locationCode) return false;
      if (cond.roomCode && cond.roomCode !== opts.roomCode) return false;
      if (cond.type && cond.type !== opts.type) return false;
      if (cond.guestsMin && opts.guests < cond.guestsMin) return false;
      if (cond.guestsMax && opts.guests > cond.guestsMax) return false;
      return true;
    });
    if (match) return match.staffing as StaffingNeed[];
  }

  const ratio = rules.serversPerGuests?.[opts.type ?? ""] ?? 25;
  const servers = Math.max(1, Math.ceil(opts.guests / ratio));
  const captains = Math.max(1, Math.ceil(servers / (rules.captainPerServers ?? 8)));
  const bartenders = Math.max(0, Math.ceil(opts.guests / (rules.bartenderPerGuests ?? 75)));
  const barbacks = bartenders > 0 ? Math.max(1, Math.ceil(bartenders / (rules.barbackPerBartenders ?? 3))) : 0;

  const needs: StaffingNeed[] = [
    { roleCode: "CAP", count: captains, note: "rule:captainPerServers" },
    { roleCode: "SVR", count: servers, note: `rule:serversPerGuests/${opts.type ?? "default"}` },
  ];
  if (bartenders > 0) needs.push({ roleCode: "BAR", count: bartenders, note: "rule:bartenderPerGuests" });
  if (barbacks > 0) needs.push({ roleCode: "BBK", count: barbacks, note: "rule:barbackPerBartenders" });
  return needs;
}

export type ExtractedBEO = {
  postAs?: string;
  account?: string;
  bookingId?: string;
  expectedGuests?: number;
  /** ISO 8601 calendar day, e.g. "2026-05-21". */
  eventDate?: string;
  /** "HH:mm" 24-hour. */
  startTime?: string;
  endTime?: string;
  /** Resolved Room code (TNG, VINEYARD, …) when we can recognise it. */
  venueCode?: string;
  /** Display label for the recognised venue. */
  venueName?: string;
  /** Free-form setup notes (table arrangement, head table, etc.). */
  setupNotes?: string;
  /** Bullet/comma-separated menu lines pulled from the doc. */
  menu?: string;
  /** Audio/visual requirements text. */
  av?: string;
  /** Anything left over the parser noticed but couldn't bucket. */
  notes?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  cateringManager?: string;
  /** Coarse confidence 0..1 for surfacing "low confidence" warnings. */
  confidence?: number;
};

// ─── Venue dictionary (built from master data) ────────────────────────────
// Aliases are case-insensitive substrings; the first match wins.
const VENUE_DICT: Array<{ code: string; name: string; aliases: string[] }> = [
  { code: "TNG", name: "Town & Gown", aliases: ["town and gown", "town & gown", "town and gown", "tng"] },
  { code: "VINEYARD", name: "Vineyard & Patio", aliases: ["vineyard"] },
  { code: "MORETON", name: "Moreton Fig Patio", aliases: ["moreton fig", "moreton"] },
  { code: "TROJAN", name: "Trojan Grand Ballroom", aliases: ["trojan grand ballroom", "trojan ballroom"] },
  { code: "FRANKLIN", name: "Franklin Suite", aliases: ["franklin suite", "franklin"] },
  { code: "FORUM", name: "The Forum at RTCC", aliases: ["the forum", "rtcc forum", "forum at rtcc"] },
  { code: "HSC-CC", name: "Health Science Conference Center", aliases: ["health science conference", "health sciences conference", "hsc-cc", "hsc cc"] },
  { code: "UCLUB", name: "University Club", aliases: ["university club", "uclub"] },
  { code: "SCRIPTORIUM", name: "Scriptorium at University Club", aliases: ["scriptorium"] },
  { code: "HOTEL-MR", name: "USC Hotel Meeting Rooms", aliases: ["usc hotel meeting room", "hotel meeting room"] },
  { code: "HOTEL-GARDEN", name: "USC Hotel Garden", aliases: ["usc hotel garden", "hotel garden"] },
  { code: "HOTEL-1880", name: "USC Hotel 1880 Founders Room", aliases: ["1880 founders", "founders room", "1880"] },
  { code: "HOTEL-GBR", name: "USC Hotel Grand Ballroom", aliases: ["usc hotel grand ballroom", "hotel grand ballroom"] },
  { code: "MCKAYS", name: "McKay's at USC Hotel", aliases: ["mckay's", "mckays", "mc kay"] },
  { code: "THE-LAB", name: "The Lab Gastropub", aliases: ["the lab gastropub", "lab gastropub"] },
  { code: "EDMONDSON", name: "The Edmondson", aliases: ["edmondson"] },
];

function matchVenue(text: string): { code: string; name: string } | null {
  const t = text.toLowerCase();
  for (const v of VENUE_DICT) {
    if (v.aliases.some((a) => t.includes(a))) return { code: v.code, name: v.name };
  }
  return null;
}

// ─── Date / time parsing ──────────────────────────────────────────────────

function parseDateFlexible(raw: string): string | undefined {
  const s = raw.trim();
  // ISO 8601
  let m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // MM/DD/YYYY or M/D/YY
  m = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  // "May 21, 2026" / "21 May 2026"
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  m = s.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const mi = months.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (m) {
    const mi = months.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return undefined;
}

function parseTime(raw: string): string | undefined {
  const s = raw.trim();
  // 24-hour HH:mm
  let m = s.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m) {
    const h = Number(m[1]);
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, "0")}:${m[2]}`;
  }
  // 12-hour "5:30 pm" / "5 pm"
  m = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (m) {
    let h = Number(m[1]);
    const min = m[2] ?? "00";
    const ampm = m[3].toLowerCase();
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
  }
  return undefined;
}

/** Local deterministic extractor (no API key required). */
function extractLocal(text: string): ExtractedBEO {
  // Normalise whitespace so multi-line PDFs parse cleanly.
  const normalised = text.replace(/\r/g, "").replace(/[\t ]+/g, " ").trim();
  const get = (re: RegExp) => normalised.match(re)?.[1]?.trim();

  const guests =
    parseInt(get(/(?:guests?|pax|attendees?|guest count|expected guests?)[:\s]+(\d{1,5})/i) ?? "") ||
    undefined;

  const postAs = get(/post[\s-]*as[:\s]+([^\n]+)/i) ?? get(/event(?: name)?[:\s]+([^\n]+)/i);
  const account = get(/account[:\s]+([^\n]+)/i) ?? get(/client[:\s]+([^\n]+)/i);
  const bookingId =
    get(/booking[\s-]*id[:\s]+([\w-]+)/i) ??
    get(/\bBK[-\s]?(20\d{2}[-\s]?\d{3,5})/i)?.replace(/[\s-]+/g, "-");

  const rawDate =
    get(/(?:event\s*date|date)[:\s]+([^\n]+)/i) ?? get(/(\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b)/);
  const eventDate = rawDate ? parseDateFlexible(rawDate) : undefined;

  const startTime =
    parseTime(get(/(?:start\s*time|begin|from)[:\s]+([^\n]+)/i) ?? "") ??
    parseTime(get(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i) ?? "");
  const endTime =
    parseTime(get(/(?:end\s*time|until|to)[:\s]+([^\n]+)/i) ?? "");

  const venue = matchVenue(normalised);

  const setupNotes =
    get(/setup\s*notes?[:\s]+([^\n]+(?:\n(?!\w+\s*[:]).+)*)/i) ??
    get(/setup[:\s]+([^\n]+)/i);
  const menu =
    get(/menu[:\s]+([^\n]+(?:\n(?!\w+\s*[:]).+)*)/i) ??
    get(/food[:\s]+([^\n]+)/i);
  const av =
    get(/a\/?\s*v[:\s]+([^\n]+(?:\n(?!\w+\s*[:]).+)*)/i) ??
    get(/audio[/\s]?visual[:\s]+([^\n]+)/i);
  const notes = get(/(?:special\s*instructions?|notes?)[:\s]+([^\n]+(?:\n(?!\w+\s*[:]).+)*)/i);

  const contactName =
    get(/contact(?:\s*name)?[:\s]+([^\n]+?)(?:\s*(?:phone|email|$))/i) ??
    get(/onsite\s*contact[:\s]+([^\n]+)/i);
  const contactEmail = get(/(?:contact\s*)?email[:\s]+([^\s\n]+@[^\s\n]+)/i);
  const contactPhone = get(/(?:contact\s*)?phone[:\s]+([\d\-().+\s]{7,})/i);
  const cateringManager = get(/catering\s*manager[:\s]+([^\n]+)/i);

  // Build a coarse confidence score: count how many "important" fields we got.
  const importantHits = [postAs, eventDate, startTime, venue?.code, guests].filter(Boolean).length;
  const confidence = Math.min(1, importantHits / 5);

  return {
    postAs,
    account,
    bookingId,
    expectedGuests: guests,
    eventDate,
    startTime,
    endTime,
    venueCode: venue?.code,
    venueName: venue?.name,
    setupNotes,
    menu,
    av,
    notes,
    contactName,
    contactEmail,
    contactPhone,
    cateringManager,
    confidence,
  };
}

/**
 * Extract BEO fields from free-form text. If OPENAI_API_KEY is set, uses
 * OpenAI's Chat Completions JSON mode; otherwise uses the local regex parser.
 * Local extractor results are always merged in as a fallback for missing fields.
 */
export async function extractBEOFromText(text: string): Promise<ExtractedBEO> {
  const local = extractLocal(text);
  const key = process.env.OPENAI_API_KEY;
  if (!key) return local;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You extract structured banquet event order (BEO) fields from messy text " +
              "(including OCR output). Return ONLY JSON matching this shape: " +
              "{ postAs?: string, account?: string, bookingId?: string, " +
              "expectedGuests?: number, eventDate?: string /* YYYY-MM-DD */, " +
              "startTime?: string /* HH:mm 24h */, endTime?: string /* HH:mm 24h */, " +
              "venueCode?: string, venueName?: string, " +
              "setupNotes?: string, menu?: string, av?: string, notes?: string, " +
              "contactName?: string, contactEmail?: string, contactPhone?: string, " +
              "cateringManager?: string }. " +
              "USC venue codes: TNG, VINEYARD, MORETON, TROJAN, FRANKLIN, FORUM, HSC-CC, " +
              "UCLUB, SCRIPTORIUM, HOTEL-MR, HOTEL-GARDEN, HOTEL-1880, HOTEL-GBR, MCKAYS, " +
              "THE-LAB, EDMONDSON. Omit unknown fields rather than guessing.",
          },
          { role: "user", content: text.slice(0, 8000) },
        ],
      }),
    });
    if (!res.ok) return local;
    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed: ExtractedBEO = content ? JSON.parse(content) : {};
    return { ...local, ...parsed };
  } catch {
    return local;
  }
}
