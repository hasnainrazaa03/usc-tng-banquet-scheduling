import { NextRequest, NextResponse } from "next/server";
import { extractBEOFromText, deriveStaffingFromGuests } from "@/lib/ai";
import { getSession } from "@/lib/auth";

/**
 * AI assist — parse raw BEO text (paste from email / PDF / handwritten notes)
 * into structured fields, and suggest staffing based on guest count.
 *
 * Uses OpenAI if OPENAI_API_KEY is set; otherwise falls back to the local
 * pattern-match extractor.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { text, type, locationCode, roomCode } = await req.json();
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const extracted = await extractBEOFromText(text);
  const guests = extracted.expectedGuests ?? 0;
  const staffing = guests
    ? deriveStaffingFromGuests({
        guests,
        type: type ?? "PLATED_DINNER",
        locationCode,
        roomCode,
      })
    : [];

  return NextResponse.json({
    extracted,
    suggestedStaffing: staffing,
    source: process.env.OPENAI_API_KEY ? "openai" : "local",
  });
}
