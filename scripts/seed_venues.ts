import "tsconfig-paths/register";
import { importMasterData } from "@/lib/import";
import fs from "node:fs";
import path from "node:path";
async function main() {
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "banquet_master_data.json"), "utf-8"));
  const r = await importMasterData(data);
  console.log(JSON.stringify(r, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
