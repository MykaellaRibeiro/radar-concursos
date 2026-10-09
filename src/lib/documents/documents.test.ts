import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { downloadPdf, hasPdfSignature, isAcceptedPdfContentType } from "./downloader";
import { sha256Buffer } from "./hash";
import { isConfidentContestMatch, normalizeDocumentLabel } from "./matching";
import { extractPdfText, normalizeExtractedText } from "./pdf";
import { documentStoragePath } from "./storage-path";
import { assertSafeDocumentUrl, isBlockedIp } from "./url-safety";
import { nextDocumentVersion } from "./versioning";

const fixture = (name: string) => join(process.cwd(), "src", "lib", "documents", "__fixtures__", name);

describe("document hash and paths", () => {
  it("calculates a stable SHA-256", () => {
    expect(sha256Buffer(Buffer.from("radar"))).toBe("ff2e963ff6d0c33aae94a7f823b6e2bf7358004063f4275ba525539cb6ec6734");
  });

  it("builds immutable content-addressed paths", () => {
    const sha256 = "a".repeat(64);
    expect(documentStoragePath({ kind: "PROVA", contestId: "contest-1", year: 2012, sha256 }))
      .toBe(`provas/contest-1/2012/${sha256}.pdf`);
    expect(documentStoragePath({ kind: "GABARITO", contestId: "contest-1", proofId: "proof-1", sha256 }))
      .toBe(`gabaritos/proof-1/${sha256}.pdf`);
  });
});

describe("download validation", () => {
  it("validates MIME and PDF signature independently from the extension", () => {
    expect(isAcceptedPdfContentType("application/pdf; charset=binary")).toBe(true);
    expect(isAcceptedPdfContentType("application/octet-stream")).toBe(true);
    expect(isAcceptedPdfContentType("text/html")).toBe(false);
    expect(hasPdfSignature(Buffer.from("%PDF-1.7"))).toBe(true);
    expect(hasPdfSignature(Buffer.from("<html>"))).toBe(false);
  });

  it("downloads a streamed PDF without using a temporary file stream", async () => {
    const body = Buffer.from("%PDF-1.7\nradar");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, {
      status: 200,
      headers: { "content-type": "application/pdf" },
    })));
    try {
      const document = await downloadPdf("https://93.184.216.34/prova.pdf", { retries: 0 });
      expect(document.buffer).toEqual(body);
      expect(document.size).toBe(body.length);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("cancels an oversized response without emitting a destroyed-stream error", async () => {
    const body = Buffer.from("%PDF-1.7\nconteudo acima do limite");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, {
      status: 200,
      headers: { "content-type": "application/pdf" },
    })));
    try {
      await expect(downloadPdf("https://93.184.216.34/prova.pdf", { maxBytes: 8, retries: 0 }))
        .rejects.toThrow(/excede o limite/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each(["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "::1", "fd00::1"])("blocks reserved address %s", (address) => {
    expect(isBlockedIp(address)).toBe(true);
  });

  it("rejects localhost and DNS rebinding to private addresses", async () => {
    await expect(assertSafeDocumentUrl("http://localhost/file.pdf")).rejects.toThrow(/bloqueado/i);
    await expect(assertSafeDocumentUrl("https://example.org/file.pdf", async () => [{ address: "10.1.2.3" }])).rejects.toThrow(/privado|reservado/i);
  });

  it("accepts a public HTTPS host after resolution", async () => {
    const url = await assertSafeDocumentUrl("https://example.org/file.pdf", async () => [{ address: "93.184.216.34" }]);
    expect(url.hostname).toBe("example.org");
  });
});

describe("PDF extraction", () => {
  it("normalizes control characters and excessive whitespace", () => {
    expect(normalizeExtractedText(" A\t  B\r\n\n\nC\u0000 ")).toBe("A B\n\nC");
  });

  it("extracts useful text from a local textual fixture", async () => {
    const result = await extractPdfText(await readFile(fixture("textual.pdf")));
    expect(result.status).toBe("TEXT");
    expect(result.text).toContain("RADAR CONCURSOS");
    expect(result.pageCount).toBe(1);
  });

  it("marks an image-only fixture as scanned without OCR", async () => {
    const result = await extractPdfText(await readFile(fixture("scanned.pdf")));
    expect(result.status).toBe("SCANNED");
    expect(result.text).toBeNull();
  });
});

describe("deduplication and versioning", () => {
  it("detects a duplicate hash", () => {
    expect(nextDocumentVersion({ id: "old", sha256: "same", version: 2 }, "same"))
      .toEqual({ duplicate: true, version: 2, supersedesId: "old" });
  });

  it("creates a new version when a known URL changes content", () => {
    expect(nextDocumentVersion({ id: "old", sha256: "before", version: 2 }, "after"))
      .toEqual({ duplicate: false, version: 3, supersedesId: "old" });
  });
});

describe("proof and contest matching", () => {
  it("requires matching organization evidence and state", () => {
    expect(isConfidentContestMatch(
      { organization: "Polícia Civil do Estado do Maranhão", state: "MA", year: 2012 },
      { organization: "Polícia Civil do Estado do Maranhão", state: "MA", title: "Polícia Civil do Maranhão — 2012" },
    )).toBe(true);
    expect(isConfidentContestMatch(
      { organization: "Polícia Civil do Estado do Maranhão", state: "MA", year: 2012 },
      { organization: "Polícia Civil do Piauí", state: "PI", title: "PC-PI" },
    )).toBe(false);
  });

  it("normalizes labels without merging unrelated roles", () => {
    expect(normalizeDocumentLabel("Investigador de Polícia")).toBe("investigador de policia");
    expect(normalizeDocumentLabel("Escrivão de Polícia")).not.toBe(normalizeDocumentLabel("Investigador de Polícia"));
  });
});
