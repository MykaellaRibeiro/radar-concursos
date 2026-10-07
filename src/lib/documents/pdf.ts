import { PDFParse } from "pdf-parse";
import type { PdfExtraction } from "./types";

export function normalizeExtractedText(value: string): string {
  return value
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPdfText(buffer: Buffer): Promise<PdfExtraction> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = normalizeExtractedText(result.text);
    const usefulCharacters = text.replace(/\s/g, "").length;
    const status = usefulCharacters >= 200 ? "TEXT" : usefulCharacters > 0 ? "PARTIAL" : "SCANNED";
    return { status, method: "pdf-parse@2.4.5", text: text || null, pageCount: result.total, error: null };
  } catch (error) {
    return {
      status: "FAILED",
      method: "pdf-parse@2.4.5",
      text: null,
      pageCount: null,
      error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
