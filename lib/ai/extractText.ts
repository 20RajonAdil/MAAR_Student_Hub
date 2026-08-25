"use client";

// ─────────────────────────────────────────────────────────────────────────
// Extracts text from an uploaded file entirely in the browser — the file
// is never sent anywhere. Supports:
//  - .txt / .md / plain text
//  - .pdf (via pdfjs-dist, worker self-hosted at /pdf.worker.min.mjs so
//    this works fully offline once the app itself is cached, with no
//    dependency on a third-party CDN)
//
// Other file types (e.g. .docx) currently return `null` — the resources
// page shows "no readable text found" for these rather than silently
// skipping them. See the implementation report for how to extend this.
// ─────────────────────────────────────────────────────────────────────────

export type ExtractResult = { text: string } | { text: null; reason: string };

export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  const type = file.type;
  const name = file.name.toLowerCase();

  if (type === "text/plain" || name.endsWith(".txt") || name.endsWith(".md")) {
    const text = await file.text();
    return { text };
  }

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      let text = "";
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
        text += pageText + "\n\n";
      }
      if (!text.trim()) {
        return { text: null, reason: "This looks like a scanned PDF with no selectable text (OCR isn't supported yet)." };
      }
      return { text };
    } catch (err) {
      console.error("PDF extraction failed", err);
      return { text: null, reason: "Couldn't read this PDF — it may be corrupted or password-protected." };
    }
  }

  return { text: null, reason: "This file type isn't supported yet — try a PDF or a .txt/.md file." };
}
