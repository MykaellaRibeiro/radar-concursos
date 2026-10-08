import { runDocumentCollection } from "../workers/collectors/documents";

function numberFlag(name: string, fallback: number): number {
  const argument = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (!argument) return fallback;
  const value = Number(argument.split("=", 2)[1]);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Valor inválido para --${name}.`);
  return value;
}

function nonNegativeNumberFlag(name: string, fallback: number): number {
  const argument = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (!argument) return fallback;
  const value = Number(argument.split("=", 2)[1]);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Valor inválido para --${name}.`);
  return value;
}

async function main() {
  const summary = await runDocumentCollection({
    dryRun: process.argv.includes("--dry-run"),
    maxConcursos: numberFlag("max-concursos", 5),
    contestOffset: nonNegativeNumberFlag("contest-offset", 0),
    rotateCatalog: /^(?:1|true|on)$/i.test(process.env.ROTATE_DOCUMENT_CATALOG ?? ""),
    maxFilesPerContest: numberFlag("max-files-per-contest", 5),
    maxFileSize: numberFlag("max-file-size", 15 * 1024 * 1024),
    timeoutMs: numberFlag("timeout", 20_000),
    concurrency: numberFlag("concurrency", 1),
    discovery: process.argv.includes("--pilot-only") ? false : undefined,
  });

  console.info(JSON.stringify(summary, null, 2));
  if (summary.errors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
