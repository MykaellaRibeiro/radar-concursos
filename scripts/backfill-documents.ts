import { runDocumentCollection, type DocumentCollectionSummary } from "../workers/collectors/documents";

function positiveNumberFlag(name: string, fallback: number, maximum: number): number {
  const argument = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (!argument) return fallback;
  const value = Number(argument.split("=", 2)[1]);
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`Valor inválido para --${name}; use um inteiro entre 1 e ${maximum}.`);
  }
  return value;
}

function addSummary(total: DocumentCollectionSummary, batch: DocumentCollectionSummary) {
  const additive: Array<keyof DocumentCollectionSummary> = [
    "found", "discoveredByExa", "discoveryContestsSearched", "discoveryResultsFound", "discoveryRejected",
    "downloaded", "uploaded", "duplicateFiles", "editaisCreated", "provasCreated", "gabaritosCreated",
    "resultadosCreated", "cutoffsCreated", "extracted", "partial", "scanned", "failed",
  ];
  for (const key of additive) {
    (total[key] as number) += batch[key] as number;
  }
  total.errors.push(...batch.errors);
  total.discoveryCatalogTotal = batch.discoveryCatalogTotal;
  total.finishedAt = batch.finishedAt;
}

async function main() {
  const batchSize = positiveNumberFlag("batch-size", 50, 50);
  const maxFileSize = positiveNumberFlag("max-file-size", 15 * 1024 * 1024, 50 * 1024 * 1024);
  const timeoutMs = positiveNumberFlag("timeout", 20_000, 120_000);
  let offset = 0;
  let totalCatalog = Number.POSITIVE_INFINITY;
  let aggregate: DocumentCollectionSummary | null = null;
  let batches = 0;

  while (offset < totalCatalog) {
    const batch = await runDocumentCollection({
      maxConcursos: batchSize,
      contestOffset: offset,
      maxFilesPerContest: 5,
      maxFileSize,
      timeoutMs,
      concurrency: 1,
      discovery: true,
    });
    if (batch.outcome !== "completed") throw new Error(`Coleta indisponível: ${batch.outcome}.`);
    console.info(JSON.stringify({ event: "document_backfill.batch", batch: batches + 1, offset, ...batch }, null, 2));

    if (!aggregate) aggregate = { ...batch, errors: [...batch.errors], discoveryCatalogOffset: 0 };
    else addSummary(aggregate, batch);
    batches += 1;
    totalCatalog = batch.discoveryCatalogTotal;
    if (batch.discoveryContestsSearched === 0) break;
    offset += batch.discoveryContestsSearched;
  }

  if (!aggregate) throw new Error("O catálogo não retornou concursos para o backfill documental.");
  console.info(JSON.stringify({ event: "document_backfill.finished", batches, ...aggregate }, null, 2));
  if (aggregate.found > 0 && aggregate.downloaded === 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
