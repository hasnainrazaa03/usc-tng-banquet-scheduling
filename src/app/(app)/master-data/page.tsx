import { prisma } from "@/lib/db";
import MasterDataEditor from "./editor";

export const dynamic = "force-dynamic";

export default async function MasterDataPage() {
  const latest = await prisma.masterDataVersion.findFirst({ orderBy: { versionNum: "desc" } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">Master Data Editor</h1>
        <p className="text-ink-muted">
          Edit the <code className="font-mono">banquet_master_data.json</code> used by the scheduling engine, BEO parser, and print layout.
          Operations staff can update this without changing code. Versions are saved automatically.
        </p>
      </div>
      <MasterDataEditor initialPayload={latest?.payload as any} initialVersion={latest?.versionNum ?? 0} />
    </div>
  );
}
