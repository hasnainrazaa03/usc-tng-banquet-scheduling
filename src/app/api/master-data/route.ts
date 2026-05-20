import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { importMasterData } from "@/lib/import";
import { MasterDataSchema } from "@/lib/master-data/schema";

export async function GET() {
  const latest = await prisma.masterDataVersion.findFirst({ orderBy: { versionNum: "desc" } });
  return NextResponse.json(latest ?? null);
}

export async function POST(req: NextRequest) {
  const s = await requireRole(["ADMIN", "MANAGER"]);
  const { payload, note, dryRun } = await req.json();
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Validate up front so the admin gets a precise error list.
  const parsed = MasterDataSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Schema validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  if (dryRun) {
    const result = await importMasterData(payload, { dryRun: true });
    return NextResponse.json({ dryRun: true, ...result });
  }

  const last = await prisma.masterDataVersion.findFirst({ orderBy: { versionNum: "desc" } });
  const next = (last?.versionNum ?? 0) + 1;

  const v = await prisma.$transaction(async (tx) => {
    const version = await tx.masterDataVersion.create({
      data: { versionNum: next, payload, importedBy: s.id, note: note ?? null },
    });
    const result = await importMasterData(payload, { tx });
    if (!result.ok) throw new Error("Import failed: " + result.errors.join("; "));
    await tx.auditLog.create({
      data: {
        userId: s.id,
        action: "MASTER_DATA_UPDATE",
        entity: "MasterDataVersion",
        entityId: version.id,
        message: `Saved master data v${next} (${result.counts.venueGroups} venue groups, ${result.counts.locations} locations, ${result.counts.rooms} rooms)`,
      },
    });
    return version;
  });

  return NextResponse.json(v);
}
