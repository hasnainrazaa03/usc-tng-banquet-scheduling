import { NextRequest, NextResponse } from "next/server";
import { extractBEOFromText, deriveStaffingFromGuests } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  const extracted = await extractBEOFromText(text ?? "");
  const staffing = extracted.expectedGuests
    ? deriveStaffingFromGuests({ guests: extracted.expectedGuests, type: "PLATED_DINNER" })
    : [];
  return NextResponse.json({ extracted, suggestedStaffing: staffing });
}
