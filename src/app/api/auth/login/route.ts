import { NextRequest, NextResponse } from "next/server";
import { authenticate, createSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  const user = await authenticate(email, password);
  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  await createSession(user);
  return NextResponse.json({ ok: true, user });
}
