/**
 * Client-side BEO file parsers.
 *
 * Both extractors run entirely in the browser to keep the Next.js server
 * bundle slim (and avoid shipping ~30 MB of OCR worker code in serverless).
 *
 * Public surface:
 *   parsePdfFile(file)  -> plain text extracted from every page
 *   parsePngFile(file, onProgress?) -> OCR text from an image
 *
 * Errors are surfaced as rejected promises with human-readable messages so
 * the calling UI can render them inline.
 */

/** Plain-text result + per-page hint so the UI can show "Parsed N pages". */
export type PdfParseResult = {
  text: string;
  pageCount: number;
};

export type OcrProgress = {
  /** 0..1 — useful for a progress bar. */
  ratio: number;
  /** Free-form status, e.g. "recognizing text". */
  status: string;
};

/**
 * Extract text from a PDF File or Blob. Uses pdf.js dynamically loaded so
 * SSR builds don't include the worker bundle.
 *
 * NOTE: pdf.js requires a workerSrc URL. We point it at the unpkg CDN copy
 * of the same version installed in package.json. If you need offline support
 * later, copy `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` into
 * `public/pdfjs/` and adjust this URL.
 */
export async function parsePdfFile(file: File | Blob): Promise<PdfParseResult> {
  if (typeof window === "undefined") {
    throw new Error("parsePdfFile must run in the browser");
  }

  // Dynamic import keeps pdf.js out of the server bundle.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdf.js refuses to render without a workerSrc. We point at the pinned CDN
  // copy of the exact version installed in package.json. For offline support,
  // copy `node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs` into
  // `public/pdfjs/` and set the URL to `/pdfjs/pdf.worker.min.mjs`.
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Group items by approximate Y coordinate so multi-column BEO templates
    // come back roughly in reading order rather than as one giant blob.
    type Item = { str: string; transform: number[] };
    const items = content.items as unknown as Item[];
    const rows = new Map<number, string[]>();
    for (const it of items) {
      if (!it.str) continue;
      const y = Math.round((it.transform?.[5] ?? 0) / 4) * 4; // 4-pt bucket
      const arr = rows.get(y) ?? [];
      arr.push(it.str);
      rows.set(y, arr);
    }
    // Sort rows top-to-bottom (PDF coordinates count up from bottom).
    const ordered = Array.from(rows.entries()).sort((a, b) => b[0] - a[0]);
    for (const [, parts] of ordered) lines.push(parts.join(" ").replace(/\s+/g, " ").trim());
    lines.push(""); // blank line between pages
  }
  return { text: lines.join("\n").trim(), pageCount: doc.numPages };
}

/**
 * Run OCR over a PNG/JPG/WEBP image via Tesseract.js.
 *
 * Tesseract loads its WASM core + English language data on first call (~10 MB
 * cached). On subsequent calls it reuses the worker so repeat imports are
 * fast.
 */
export async function parsePngFile(
  file: File | Blob,
  onProgress?: (p: OcrProgress) => void,
): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("parsePngFile must run in the browser");
  }
  const tesseract = await import("tesseract.js");
  const { data } = await tesseract.recognize(file, "eng", {
    logger: (m: { progress?: number; status?: string }) => {
      if (onProgress) onProgress({ ratio: m.progress ?? 0, status: m.status ?? "" });
    },
  });
  return (data?.text ?? "").trim();
}
