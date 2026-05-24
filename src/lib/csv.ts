/**
 * CSV export utilities (Phase 13).
 *
 * Tiny, dependency-free RFC-4180-ish writer:
 *   • Always quotes every field for safety.
 *   • Escapes embedded `"` by doubling them.
 *   • Joins with CRLF (Excel preference).
 *   • Prepends UTF-8 BOM so Excel honours non-ASCII characters.
 */
export type CsvValue = string | number | boolean | null | undefined | Date;

function escapeCell(v: CsvValue): string {
  if (v === null || v === undefined) return "\"\"";
  let s: string;
  if (v instanceof Date) {
    s = v.toISOString();
  } else if (typeof v === "boolean") {
    s = v ? "true" : "false";
  } else {
    s = String(v);
  }
  return "\"" + s.replace(/"/g, "\"\"") + "\"";
}

export function toCsv(rows: CsvValue[][]): string {
  return "\uFEFF" + rows.map((r) => r.map(escapeCell).join(",")).join("\r\n");
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
