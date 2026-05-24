import { NextRequest, NextResponse } from "next/server";
import { deriveStaffingFromGuests } from "@/lib/ai";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * AI assist — given guest count + event metadata, return suggested staffing
 * needs by role. Uses common patterns from banquet_master_data.json first,
 * then falls back to staffingRules ratios.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { guests, type, locationCode, roomCode } = await req.json();
  const n = Number(guests);
  if (!Number.isFinite(n) || n <= 0) {
    return NextResponse.json({ error: "guests must be a positive number" }, { status: 400 });
  }

  const needs = deriveStaffingFromGuests({
    guests: n,
    type: type ?? "PLATED_DINNER",
    locationCode,
    roomCode,
  });

  return NextResponse.json({ needs });
}
