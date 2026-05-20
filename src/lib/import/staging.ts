/**
 * Staging-based import adapter contracts (v0.3).
 *
 * Every external feed (roster CSV, historical schedule export, BEO PDF, etc.)
 * lands in the `ImportStage` table first. An adapter is then responsible for:
 *
 *   1. `parse(file)`     — turn raw bytes into structured rows
 *   2. `validate(rows)`  — synchronous schema/business-rule checks
 *   3. `promote(stageId)` — write valid rows into the canonical tables
 *
 * Adapters do NOT mutate canonical tables before validation succeeds, so a
 * failed import never leaves partial state behind. The staging row keeps the
 * original payload so re-runs after a fix don't require re-uploading.
 *
 * This module ships the contracts + a roster CSV stub. Future adapters
 * (beo-csv, beo-pdf, schedule-history, seniority) follow the same shape.
 */

export type ValidationIssue = {
  field?: string;
  row?: number;
  message: string;
  severity: "error" | "warning";
};

export type ValidationResult<T> = {
  ok: boolean;
  rows: T[];
  issues: ValidationIssue[];
};

export type PromoteResult = {
  imported: number;
  skipped: number;
  errors: ValidationIssue[];
};

export interface ImportAdapter<TRaw, TParsed> {
  /** Stable identifier; matches the `source` column on `ImportStage`. */
  readonly source: string;
  /** Display label for the UI. */
  readonly label: string;

  parse(raw: TRaw): TParsed[] | Promise<TParsed[]>;
  validate(rows: TParsed[]): ValidationResult<TParsed>;
  promote(stageIds: string[], opts?: { userId?: string }): Promise<PromoteResult>;
}

/**
 * Parsed roster row (matches the canonical Server fields we currently accept).
 */
export type RosterRow = {
  employeeId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  hireDate?: string; // ISO yyyy-mm-dd
  primaryRole?: string; // role code (CAP/SVR/BAR/...)
  status?: "ACTIVE" | "INACTIVE";
};

/**
 * Roster CSV adapter (stub). Parses a CSV string with header row matching
 * the RosterRow shape. Promotion is intentionally not implemented yet — it
 * will land in v0.4 alongside the staging UI.
 */
export const rosterCsvAdapter: ImportAdapter<string, RosterRow> = {
  source: "roster-csv",
  label: "Server Roster (CSV)",

  parse(raw: string): RosterRow[] {
    const lines = raw.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const header = lines[0].split(",").map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      const obj: Record<string, string> = {};
      header.forEach((h, i) => (obj[h] = cols[i] ?? ""));
      return {
        employeeId: obj.employeeId ?? obj.employee_id ?? "",
        firstName: obj.firstName ?? obj.first_name ?? "",
        lastName: obj.lastName ?? obj.last_name ?? "",
        email: obj.email || undefined,
        phone: obj.phone || undefined,
        hireDate: obj.hireDate || obj.hire_date || undefined,
        primaryRole: obj.primaryRole || obj.primary_role || undefined,
        status: (obj.status as "ACTIVE" | "INACTIVE") || undefined,
      };
    });
  },

  validate(rows: RosterRow[]): ValidationResult<RosterRow> {
    const issues: ValidationIssue[] = [];
    rows.forEach((r, i) => {
      const row = i + 2; // header + 1-index
      if (!r.employeeId) issues.push({ row, field: "employeeId", severity: "error", message: "Missing employeeId" });
      if (!r.firstName) issues.push({ row, field: "firstName", severity: "error", message: "Missing firstName" });
      if (!r.lastName) issues.push({ row, field: "lastName", severity: "error", message: "Missing lastName" });
      if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) {
        issues.push({ row, field: "email", severity: "warning", message: "Email format suspicious" });
      }
      if (r.hireDate && !/^\d{4}-\d{2}-\d{2}$/.test(r.hireDate)) {
        issues.push({ row, field: "hireDate", severity: "error", message: "hireDate must be YYYY-MM-DD" });
      }
    });
    return {
      ok: !issues.some((i) => i.severity === "error"),
      rows,
      issues,
    };
  },

  async promote(): Promise<PromoteResult> {
    // Promotion lands in v0.4. For now staging + validation is the surface.
    return {
      imported: 0,
      skipped: 0,
      errors: [{ severity: "error", message: "Roster promotion not yet implemented (planned v0.4)" }],
    };
  },
};

/** Registry of available adapters, keyed by `source`. */
export const adapters: Record<string, ImportAdapter<unknown, unknown>> = {
  [rosterCsvAdapter.source]: rosterCsvAdapter as unknown as ImportAdapter<unknown, unknown>,
};
