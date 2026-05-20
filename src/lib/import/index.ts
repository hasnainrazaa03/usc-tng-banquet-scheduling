/**
 * Import adapter registry.
 *
 * Adapters convert external/raw inputs into our normalized shapes.
 * Each adapter exposes: validate(raw) → result, and import(raw, opts).
 *
 * Current adapters:
 *  - master-data-importer: full banquet master data JSON.
 *
 * Future adapters (stubs documented for now):
 *  - roster-csv: server roster spreadsheet.
 *  - beo-csv: bulk BEO import from CSV.
 *  - beo-pdf: BEO extraction from PDF (uses /api/ai/extract-beo).
 */

export { importMasterData } from "./master-data-importer";
export type { ImportResult } from "./master-data-importer";
