import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const latest = await prisma.masterDataVersion.findFirst({ orderBy: { versionNum: "desc" } });
  return NextResponse.json(latest ?? null);
}

export async function POST(req: NextRequest) {
  const s = await requireRole(["ADMIN", "MANAGER"]);
  const { payload, note } = await req.json();
  if (!payload || typeof payload !== "object") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const last = await prisma.masterDataVersion.findFirst({ orderBy: { versionNum: "desc" } });
  const next = (last?.versionNum ?? 0) + 1;
  const v = await prisma.masterDataVersion.create({
    data: { versionNum: next, payload, importedBy: s.id, note: note ?? null },
  });
  await prisma.auditLog.create({
    data: { userId: s.id, action: "MASTER_DATA_UPDATE", entity: "MasterDataVersion", entityId: v.id, message: `Saved master data v${next}` },
  });
  return NextResponse.json(v);
}
