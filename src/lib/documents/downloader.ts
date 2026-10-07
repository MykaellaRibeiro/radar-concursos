import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { assertSafeDocumentUrl } from "./url-safety";
import type { DownloadedDocument } from "./types";

const PDF_SIGNATURE = Buffer.from("%PDF-");
const ACCEPTED_CONTENT_TYPES = new Set(["application/pdf", "application/octet-stream", "binary/octet-stream"]);

export function isAcceptedPdfContentType(value: string | null): boolean {
  if (!value) return true;
  return ACCEPTED_CONTENT_TYPES.has(value.split(";", 1)[0].trim().toLowerCase());
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  return bytes.length >= PDF_SIGNATURE.length && PDF_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function filenameFromHeaders(response: Response, url: URL): string | null {
  const disposition = response.headers.get("content-disposition");
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition?.match(/filename="?([^";]+)"?/i)?.[1];
  const candidate = encoded ? decodeURIComponent(encoded) : plain ?? url.pathname.split("/").pop();
  return candidate?.slice(0, 240) || null;
}

async function writeChunk(stream: ReturnType<typeof createWriteStream>, chunk: Uint8Array) {
  if (!stream.write(chunk)) await once(stream, "drain");
}

export async function downloadPdf(
  sourceUrl: string,
  options: { timeoutMs?: number; maxBytes?: number; retries?: number; maxRedirects?: number } = {},
): Promise<DownloadedDocument> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const maxBytes = options.maxBytes ?? 15 * 1024 * 1024;
  const retries = options.retries ?? 2;
  const maxRedirects = options.maxRedirects ?? 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const temporaryPath = join(tmpdir(), `radar-document-${randomUUID()}.pdf`);
    try {
      let currentUrl = await assertSafeDocumentUrl(sourceUrl);
      let response: Response | null = null;
      for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          response = await fetch(currentUrl, {
            redirect: "manual",
            signal: controller.signal,
            headers: { accept: "application/pdf,application/octet-stream;q=0.8", "user-agent": "RadarConcursosDocumentCollector/1.0" },
          });
        } finally {
          clearTimeout(timer);
        }
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get("location");
        if (!location) throw new Error("Redirecionamento sem destino.");
        if (redirects === maxRedirects) throw new Error("Limite de redirecionamentos excedido.");
        currentUrl = await assertSafeDocumentUrl(new URL(location, currentUrl).toString());
      }
      if (!response?.ok || !response.body) throw new Error(`Download recusado (${response?.status ?? "sem resposta"}).`);
      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new Error("PDF excede o limite de tamanho configurado.");
      const declaredType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
      if (!isAcceptedPdfContentType(declaredType)) throw new Error(`MIME não permitido: ${declaredType}.`);

      const stream = createWriteStream(temporaryPath, { flags: "wx" });
      const reader = response.body.getReader();
      const hash = createHash("sha256");
      let size = 0;
      let signature = Buffer.alloc(0);
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) throw new Error("PDF excede o limite de tamanho configurado.");
          if (signature.length < PDF_SIGNATURE.length) signature = Buffer.concat([signature, Buffer.from(value)]).subarray(0, PDF_SIGNATURE.length);
          hash.update(value);
          await writeChunk(stream, value);
        }
        stream.end();
        await once(stream, "close");
      } catch (error) {
        stream.destroy();
        throw error;
      }
      if (!hasPdfSignature(signature)) throw new Error("Assinatura de PDF ausente ou inválida.");
      const buffer = await readFile(temporaryPath);
      return {
        buffer,
        sha256: hash.digest("hex"),
        mimeType: "application/pdf",
        size,
        finalUrl: currentUrl.toString(),
        originalFilename: filenameFromHeaders(response, currentUrl),
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;
      if (attempt <= retries) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
