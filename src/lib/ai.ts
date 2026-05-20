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
  startTime?: string;
  endTime?: string;
};

/** Local deterministic extractor (no API key required). */
function extractLocal(text: string): ExtractedBEO {
  const get = (re: RegExp) => text.match(re)?.[1]?.trim();
  const guests = parseInt(get(/(?:guests?|pax|attendees?)[:\s]+(\d{1,5})/i) ?? "") || undefined;
  const postAs = get(/post[\s-]*as[:\s]+(.+)/i);
  const account = get(/account[:\s]+(.+)/i);
  const bookingId = get(/booking[\s-]*id[:\s]+([\w-]+)/i);
  const startTime = get(/start[\s-]*time[:\s]+(.+)/i);
  const endTime = get(/end[\s-]*time[:\s]+(.+)/i);
  return { postAs, account, bookingId, expectedGuests: guests, startTime, endTime };
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
              "You extract structured banquet event order (BEO) fields from messy text. " +
              "Return ONLY JSON matching: { postAs?: string, account?: string, bookingId?: string, " +
              "expectedGuests?: number, startTime?: string, endTime?: string }. Omit unknown fields.",
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
