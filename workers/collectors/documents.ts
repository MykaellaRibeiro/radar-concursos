import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Collector } from "../../src/lib/collectors/types";
import { downloadPdf } from "../../src/lib/documents/downloader";
import { extractExplicitCutoffScores } from "../../src/lib/documents/cutoff";
import { extractPdfText } from "../../src/lib/documents/pdf";
import { documentStoragePath } from "../../src/lib/documents/storage-path";
import type { ContestSeed, DocumentCandidate, DownloadedDocument, PdfExtraction } from "../../src/lib/documents/types";
import { nextDocumentVersion } from "../../src/lib/documents/versioning";
import { documentPilotCandidates } from "./document-pilot";
import { discoverCatalogDocuments, type DocumentDiscoveryReport } from "./document-discovery";
import { ExaSearchProvider } from "../../src/lib/providers/search/exa";
import { SerperSearchProvider } from "../../src/lib/providers/search/serper";
import type { SearchProvider } from "../../src/lib/providers/search/types";
import { errorContext, operationalLog } from "../../src/lib/operations/logger";
import { beginCollectorRun, finishCollectorRun, heartbeatCollectorRun } from "../lib/collector-runtime";

const BUCKET = "radar-documentos";

function defaultDocumentSearchProvider(): SearchProvider {
  const preferred = process.env.DOCUMENT_SEARCH_PROVIDER?.trim().toLowerCase();
  if (preferred === "exa") return new ExaSearchProvider();
  if (preferred && preferred !== "serper") throw new Error(`Provedor documental inválido: ${preferred}.`);
  if (process.env.SERPER_API_KEY?.trim()) return new SerperSearchProvider();
  return new ExaSearchProvider();
}

export interface DocumentCollectionOptions {
  dryRun?: boolean;
  maxConcursos?: number;
  contestOffset?: number;
  rotateCatalog?: boolean;
  maxFilesPerContest?: number;
  maxFileSize?: number;
  timeoutMs?: number;
  concurrency?: number;
  discovery?: boolean;
}

export interface DocumentCollectionSummary {
  provider: "document_collector";
  searchProvider: string;
  dryRun: boolean;
  found: number;
  discoveredByExa: number;
  discoveryCatalogTotal: number;
  discoveryCatalogOffset: number;
  discoveryContestsSearched: number;
  discoveryResultsFound: number;
  discoveryRejected: number;
  downloaded: number;
  uploaded: number;
  duplicateFiles: number;
  editaisCreated: number;
  provasCreated: number;
  gabaritosCreated: number;
  resultadosCreated: number;
  cutoffsCreated: number;
  extracted: number;
  partial: number;
  scanned: number;
  failed: number;
  errors: Array<{ key: string; message: string }>;
  startedAt: string;
  finishedAt: string;
  collectionId: string | null;
  outcome: "completed" | "disabled" | "already_running";
}

type PersistedFile = { id: string; sha256: string; storage_path: string; storage_bucket: string; version: number };

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente do collector.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function movementFingerprint(contestId: string, candidate: DocumentCandidate, sha256: string): string {
  return createHash("sha256").update([contestId, candidate.kind, candidate.publishedAt ?? "sem-data", sha256].join("|")).digest("hex");
}

function limitedCandidates(options: DocumentCollectionOptions): DocumentCandidate[] {
  const maxContests = Math.min(Math.max(options.maxConcursos ?? 5, 1), 10);
  const maxFiles = Math.min(Math.max(options.maxFilesPerContest ?? 5, 1), 10);
  const selectedContests = [...new Set(documentPilotCandidates.map((item) => item.contestSlug))].slice(0, maxContests);
  const counts = new Map<string, number>();
  return documentPilotCandidates.filter((item) => {
    if (!selectedContests.includes(item.contestSlug)) return false;
    const count = counts.get(item.contestSlug) ?? 0;
    if (count >= maxFiles) return false;
    counts.set(item.contestSlug, count + 1);
    return true;
  });
}

function discoveryEnabled(options: DocumentCollectionOptions) {
  if (typeof options.discovery === "boolean") return options.discovery;
  return !/^(?:0|false|off)$/i.test(process.env.ENABLE_DOCUMENT_DISCOVERY ?? "true");
}

function pilotDiscovery(options: DocumentCollectionOptions): DocumentDiscoveryReport {
  const candidates = limitedCandidates(options);
  return {
    candidates,
    catalogTotal: new Set(documentPilotCandidates.map((item) => item.contestSlug)).size,
    catalogOffset: 0,
    contestsSearched: new Set(candidates.map((item) => item.contestSlug)).size,
    resultsFound: candidates.length,
    rejected: 0,
    errors: [],
  };
}

async function ensureContest(client: SupabaseClient, slug: string, seed?: ContestSeed): Promise<string> {
  const existing = await client.from("concursos").select("id").eq("slug", slug).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id;
  if (!seed) throw new Error(`Concurso não encontrado: ${slug}.`);

  const organization = await client.from("orgaos").upsert({
    nome: seed.organization,
    sigla: seed.organizationAcronym,
    slug: seed.organizationSlug,
    tipo: "POLICIA_CIVIL",
    uf: seed.state,
    site_oficial: seed.officialUrl,
  }, { onConflict: "slug" }).select("id").single();
  if (organization.error) throw organization.error;
  const contest = await client.from("concursos").upsert({
    slug: seed.slug,
    titulo: seed.title,
    orgao_id: organization.data.id,
    status: seed.status,
    confidence: "OFFICIAL",
    uf: seed.state,
    official_url: seed.officialUrl,
    provider: seed.provider,
    external_id: seed.externalId,
    deduplication_key: `${seed.organizationSlug}|2012|concurso-publico`,
    raw_metadata: { source: seed.officialUrl, created_by: "document_collector", evidence: "FGV Conhecimento" },
  }, { onConflict: "slug" }).select("id").single();
  if (contest.error) throw contest.error;
  return contest.data.id;
}

async function ensureSource(client: SupabaseClient, candidate: DocumentCandidate): Promise<string> {
  const source = await client.from("fontes").upsert({
    nome: candidate.source.name,
    dominio: candidate.source.domain,
    tipo: candidate.source.type,
    official: candidate.source.official,
    reliability_score: candidate.source.reliabilityScore,
  }, { onConflict: "dominio,tipo" }).select("id").single();
  if (source.error) throw source.error;
  return source.data.id;
}

async function ensureExamRelations(client: SupabaseClient, contestId: string, candidate: DocumentCandidate) {
  if (!candidate.exam) return { boardId: null, roleId: null };
  let boardId: string | null = null;
  let roleId: string | null = null;
  if (candidate.exam.boardSlug && candidate.exam.boardName) {
    const board = await client.from("bancas").upsert({
      nome: candidate.exam.boardName,
      sigla: candidate.exam.boardAcronym,
      slug: candidate.exam.boardSlug,
      site: candidate.exam.boardSite,
    }, { onConflict: "slug" }).select("id").single();
    if (board.error) throw board.error;
    boardId = board.data.id;
    const linked = await client.from("concursos_bancas").upsert({ concurso_id: contestId, banca_id: boardId, is_primary: true }, { onConflict: "concurso_id,banca_id", ignoreDuplicates: true });
    if (linked.error) throw linked.error;
  }
  if (candidate.exam.role) {
    const roleName = candidate.exam.role;
    const found = await client.from("cargos").select("id").ilike("nome", roleName).limit(1).maybeSingle();
    if (found.error) throw found.error;
    if (found.data) roleId = found.data.id;
    else {
      const role = await client.from("cargos").insert({ nome: roleName, slug: `${slugify(roleName)}-${shortHash(roleName)}` }).select("id").single();
      if (role.error) throw role.error;
      roleId = role.data.id;
    }
    const linked = await client.from("concursos_cargos").upsert({ concurso_id: contestId, cargo_id: roleId }, { onConflict: "concurso_id,cargo_id", ignoreDuplicates: true });
    if (linked.error) throw linked.error;
  }
  return { boardId, roleId };
}

async function persistFile(input: {
  client: SupabaseClient;
  candidate: DocumentCandidate;
  contestId: string;
  sourceId: string;
  downloaded: DownloadedDocument;
  extraction: PdfExtraction;
  proofId?: string | null;
  year?: number | null;
}): Promise<{ file: PersistedFile; uploaded: boolean; duplicate: boolean }> {
  const { client, candidate, contestId, sourceId, downloaded, extraction } = input;
  const sameHash = await client.from("arquivos").select("id,sha256,storage_path,storage_bucket,version").eq("sha256", downloaded.sha256).maybeSingle();
  if (sameHash.error) throw sameHash.error;
  if (sameHash.data) return { file: sameHash.data as PersistedFile, uploaded: false, duplicate: true };

  const previousQuery = await client.from("arquivos").select("id,sha256,version")
    .eq("concurso_id", contestId).eq("tipo", candidate.kind).eq("source_url", candidate.sourceUrl)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  if (previousQuery.error) throw previousQuery.error;
  const version = nextDocumentVersion(previousQuery.data, downloaded.sha256);
  const storagePath = documentStoragePath({ kind: candidate.kind, contestId, sha256: downloaded.sha256, year: input.year, proofId: input.proofId });
  const upload = await client.storage.from(BUCKET).upload(storagePath, downloaded.buffer, {
    contentType: downloaded.mimeType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (upload.error) throw upload.error;

  const inserted = await client.from("arquivos").insert({
    concurso_id: contestId,
    tipo: candidate.kind,
    titulo: candidate.title,
    fonte_id: sourceId,
    source_url: candidate.sourceUrl,
    storage_bucket: BUCKET,
    storage_path: storagePath,
    mime_type: downloaded.mimeType,
    file_size: downloaded.size,
    sha256: downloaded.sha256,
    hash: downloaded.sha256,
    published_at: candidate.publishedAt,
    downloaded_at: new Date().toISOString(),
    extraction_status: extraction.status,
    extraction_method: extraction.method,
    extraction_error: extraction.error,
    texto_extraido: extraction.text,
    page_count: extraction.pageCount,
    version: version.version,
    supersedes_id: version.supersedesId,
    metadata: {
      original_filename: downloaded.originalFilename,
      content_type: downloaded.mimeType,
      content_length: downloaded.size,
      etag: downloaded.etag,
      last_modified: downloaded.lastModified,
      source_domain: candidate.source.domain,
      final_url: downloaded.finalUrl,
      discovery_url: candidate.discoveryUrl,
      download_attempts: downloaded.attempts,
      pilot_key: candidate.key,
    },
  }).select("id,sha256,storage_path,storage_bucket,version").single();
  if (inserted.error) {
    await client.storage.from(BUCKET).remove([storagePath]);
    throw inserted.error;
  }
  return { file: inserted.data as PersistedFile, uploaded: true, duplicate: false };
}

async function persistSemanticDocument(input: {
  client: SupabaseClient;
  candidate: DocumentCandidate;
  contestId: string;
  file: PersistedFile;
  boardId: string | null;
  roleId: string | null;
  proofIds: Map<string, string>;
  extraction: PdfExtraction;
}): Promise<{ created: boolean; proofId: string | null }> {
  const { client, candidate, contestId, file, boardId, roleId, proofIds, extraction } = input;
  if (candidate.kind === "EDITAL" || candidate.kind === "RETIFICACAO") {
    const existing = await client.from("editais").select("id").eq("concurso_id", contestId).eq("hash", file.sha256).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { created: false, proofId: null };
    const row = await client.from("editais").insert({
      concurso_id: contestId, banca_id: boardId, arquivo_id: file.id,
      tipo: candidate.semanticType, numero: candidate.notice?.number ?? null, ano: candidate.notice?.year ?? null,
      titulo: candidate.title, url_original: candidate.sourceUrl, source_url: candidate.sourceUrl,
      storage_bucket: file.storage_bucket, storage_path: file.storage_path, texto_extraido: extraction.text,
      published_at: candidate.publishedAt, hash: file.sha256, sha256: file.sha256, version: file.version,
    }).select("id").single();
    if (row.error) throw row.error;
    return { created: true, proofId: null };
  }
  if (candidate.kind === "PROVA") {
    const existing = await client.from("provas").select("id").eq("concurso_id", contestId).eq("arquivo_id", file.id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { created: false, proofId: existing.data.id };
    const row = await client.from("provas").insert({
      concurso_id: contestId, banca_id: boardId, cargo_id: roleId, arquivo_id: file.id,
      ano: candidate.exam?.year ?? null, turno: candidate.exam?.shift ?? null, tipo: candidate.semanticType,
      titulo: candidate.title, url_original: candidate.sourceUrl, source_url: candidate.sourceUrl,
      storage_bucket: file.storage_bucket, storage_path: file.storage_path, sha256: file.sha256,
      texto_extraido: extraction.text, published_at: candidate.publishedAt,
      quantidade_questoes: candidate.exam?.questionCount ?? null, version: file.version,
    }).select("id").single();
    if (row.error) throw row.error;
    proofIds.set(candidate.key, row.data.id);
    return { created: true, proofId: row.data.id };
  }
  if (candidate.kind === "GABARITO") {
    const proofId = candidate.relatedProofKey ? proofIds.get(candidate.relatedProofKey) : null;
    if (!proofId) throw new Error(`Prova relacionada não encontrada para ${candidate.key}.`);
    const existing = await client.from("gabaritos").select("id").eq("prova_id", proofId).eq("arquivo_id", file.id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { created: false, proofId };
    const row = await client.from("gabaritos").insert({
      prova_id: proofId, arquivo_id: file.id, tipo: candidate.semanticType,
      titulo: candidate.title, url_original: candidate.sourceUrl, source_url: candidate.sourceUrl,
      storage_bucket: file.storage_bucket, storage_path: file.storage_path, sha256: file.sha256,
      texto_extraido: extraction.text, published_at: candidate.publishedAt, version: file.version,
    });
    if (row.error) throw row.error;
    return { created: true, proofId };
  }
  if (candidate.kind === "RESULTADO") {
    const existing = await client.from("resultados").select("id").eq("concurso_id", contestId).eq("arquivo_id", file.id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { created: false, proofId: null };
    const row = await client.from("resultados").insert({
      concurso_id: contestId, cargo_id: roleId, arquivo_id: file.id, tipo: candidate.semanticType,
      titulo: candidate.title, url: candidate.sourceUrl, storage_bucket: file.storage_bucket,
      storage_path: file.storage_path, sha256: file.sha256, published_at: candidate.publishedAt,
    });
    if (row.error) throw row.error;
    return { created: true, proofId: null };
  }
  return { created: false, proofId: null };
}

async function persistExplicitCutoffs(input: {
  client: SupabaseClient;
  candidate: DocumentCandidate;
  contestId: string;
  roleId: string | null;
  sourceId: string;
  file: PersistedFile;
  extraction: PdfExtraction;
}) {
  if (input.candidate.kind !== "RESULTADO") return 0;
  const scores = extractExplicitCutoffScores(input.extraction.text);
  let created = 0;
  for (const score of scores) {
    let query = input.client.from("notas_corte").select("id")
      .eq("concurso_id", input.contestId)
      .eq("modalidade", score.modality)
      .eq("nota", score.score)
      .eq("arquivo_id", input.file.id);
    query = input.roleId ? query.eq("cargo_id", input.roleId) : query.is("cargo_id", null);
    const existing = await query.maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) continue;
    const inserted = await input.client.from("notas_corte").insert({
      concurso_id: input.contestId,
      cargo_id: input.roleId,
      modalidade: score.modality,
      nota: score.score,
      classificacao: score.classification,
      ano: input.candidate.exam?.year ?? null,
      arquivo_id: input.file.id,
      fonte_id: input.sourceId,
      source_url: input.candidate.sourceUrl,
      published_at: input.candidate.publishedAt,
      confidence: "OFFICIAL",
      extraction_method: "explicit-cutoff-v1",
      raw_metadata: { evidence: score.evidence, document_key: input.candidate.key },
    });
    if (inserted.error) throw inserted.error;
    created += 1;
  }
  return created;
}

async function persistMovement(client: SupabaseClient, candidate: DocumentCandidate, contestId: string, sourceId: string, sha256: string) {
  if (!['EDITAL', 'RETIFICACAO', 'GABARITO', 'RESULTADO'].includes(candidate.kind)) return;
  const fingerprint = movementFingerprint(contestId, candidate, sha256);
  const existing = await client.from("movimentacoes").select("id").eq("event_fingerprint", fingerprint).maybeSingle();
  if (existing.error || existing.data) return;
  const typeByKind: Record<string, string> = { EDITAL: "EDITAL_PUBLICADO", RETIFICACAO: "RETIFICACAO", GABARITO: "GABARITO_PUBLICADO", RESULTADO: "RESULTADO_PUBLICADO" };
  const movement = await client.from("movimentacoes").insert({
    concurso_id: contestId,
    tipo: typeByKind[candidate.kind],
    titulo: candidate.title,
    descricao: "Documento oficial validado e preservado no acervo do Radar.",
    event_date: candidate.publishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    occurred_at: candidate.publishedAt,
    confidence: "OFFICIAL",
    event_fingerprint: fingerprint,
    metadata: { document_sha256: sha256, document_kind: candidate.kind },
  }).select("id").single();
  if (movement.error) throw movement.error;
  const link = await client.from("movimentacao_fontes").insert({
    movimentacao_id: movement.data.id, fonte_id: sourceId, url: candidate.sourceUrl,
    titulo: candidate.title, published_at: candidate.publishedAt, content_hash: sha256, confidence: "OFFICIAL",
  });
  if (link.error) throw link.error;
}

export class DocumentCollector implements Collector<DocumentCollectionSummary> {
  readonly name = "document_collector";
  stats: DocumentCollectionSummary | null = null;

  constructor(
    private readonly client: SupabaseClient = adminClient(),
    private readonly searchProvider: SearchProvider = defaultDocumentSearchProvider(),
  ) {}

  async discover(options: DocumentCollectionOptions = {}): Promise<DocumentDiscoveryReport> {
    if (!discoveryEnabled(options)) return pilotDiscovery(options);
    return discoverCatalogDocuments({
      client: this.client,
      searchProvider: this.searchProvider,
      maxContests: Math.min(Math.max(options.maxConcursos ?? 5, 1), 50),
      maxFilesPerContest: Math.min(Math.max(options.maxFilesPerContest ?? 5, 1), 10),
      contestOffset: Math.max(options.contestOffset ?? 0, 0),
      rotateCatalog: options.rotateCatalog,
    });
  }

  async healthCheck() {
    const { data, error } = await this.client.storage.listBuckets();
    return { ok: !error && Boolean(data?.some((bucket) => bucket.id === BUCKET)), message: error?.message ?? "Bucket documental disponível." };
  }

  async run(options: DocumentCollectionOptions = {}): Promise<DocumentCollectionSummary> {
    if ((options.concurrency ?? 1) > 4) throw new Error("Concorrência máxima permitida: 4.");
    const startedAt = new Date().toISOString();
    const start = options.dryRun ? null : await beginCollectorRun(this.client, "document_collector", this.name, { bucket: BUCKET, concurrency: options.concurrency ?? 1 });
    const collectionId = start?.state === "acquired" ? start.lease.runId : null;
    const summary: DocumentCollectionSummary = {
      provider: "document_collector", searchProvider: this.searchProvider.name,
      dryRun: Boolean(options.dryRun), found: 0,
      discoveredByExa: 0, discoveryCatalogTotal: 0, discoveryCatalogOffset: 0,
      discoveryContestsSearched: 0, discoveryResultsFound: 0,
      discoveryRejected: 0, downloaded: 0,
      uploaded: 0, duplicateFiles: 0, editaisCreated: 0, provasCreated: 0, gabaritosCreated: 0,
      resultadosCreated: 0, cutoffsCreated: 0,
      extracted: 0, partial: 0, scanned: 0, failed: 0, errors: [], startedAt, finishedAt: startedAt, collectionId,
      outcome: start && start.state !== "acquired" ? start.state : "completed",
    };
    if (start && start.state !== "acquired") return summary;
    let discovery: DocumentDiscoveryReport;
    try {
      discovery = await this.discover(options);
    } catch (error) {
      if (start?.state === "acquired") await finishCollectorRun(this.client, start.lease, { status: "FAILED", error });
      throw error;
    }
    const candidates = discovery.candidates;
    summary.found = candidates.length;
    summary.discoveredByExa = discoveryEnabled(options) ? candidates.length : 0;
    summary.discoveryCatalogTotal = discovery.catalogTotal;
    summary.discoveryCatalogOffset = discovery.catalogOffset;
    summary.discoveryContestsSearched = discovery.contestsSearched;
    summary.discoveryResultsFound = discovery.resultsFound;
    summary.discoveryRejected = discovery.rejected;
    summary.errors.push(...discovery.errors);
    const proofIds = new Map<string, string>();

    for (const candidate of candidates) {
      try {
        const downloaded = await downloadPdf(candidate.sourceUrl, { timeoutMs: options.timeoutMs, maxBytes: options.maxFileSize });
        summary.downloaded += 1;
        const extraction = await extractPdfText(downloaded.buffer);
        if (extraction.status === "TEXT") summary.extracted += 1;
        if (extraction.status === "PARTIAL") summary.partial += 1;
        if (extraction.status === "SCANNED") summary.scanned += 1;
        if (extraction.status === "FAILED") summary.failed += 1;
        if (options.dryRun) {
          console.info(`[documents][dry-run] ${candidate.key}: ${downloaded.size} bytes, ${downloaded.sha256}, ${extraction.status}`);
          continue;
        }
        const contestId = await ensureContest(this.client, candidate.contestSlug, candidate.contestSeed);
        const sourceId = await ensureSource(this.client, candidate);
        const relations = await ensureExamRelations(this.client, contestId, candidate);
        const relatedProofId = candidate.relatedProofKey ? proofIds.get(candidate.relatedProofKey) ?? null : null;
        const persisted = await persistFile({ client: this.client, candidate, contestId, sourceId, downloaded, extraction, proofId: relatedProofId, year: candidate.exam?.year });
        if (persisted.uploaded) summary.uploaded += 1;
        if (persisted.duplicate) summary.duplicateFiles += 1;
        const semantic = await persistSemanticDocument({ client: this.client, candidate, contestId, file: persisted.file, boardId: relations.boardId, roleId: relations.roleId, proofIds, extraction });
        if (candidate.kind === "PROVA" && semantic.proofId) proofIds.set(candidate.key, semantic.proofId);
        if (semantic.created && ['EDITAL', 'RETIFICACAO'].includes(candidate.kind)) summary.editaisCreated += 1;
        if (semantic.created && candidate.kind === "PROVA") summary.provasCreated += 1;
        if (semantic.created && candidate.kind === "GABARITO") summary.gabaritosCreated += 1;
        if (semantic.created && candidate.kind === "RESULTADO") summary.resultadosCreated += 1;
        summary.cutoffsCreated += await persistExplicitCutoffs({
          client: this.client, candidate, contestId, roleId: relations.roleId, sourceId,
          file: persisted.file, extraction,
        });
        await persistMovement(this.client, candidate, contestId, sourceId, persisted.file.sha256);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        summary.errors.push({ key: candidate.key, message });
        operationalLog("warn", "collector.item_failed", { collector: this.name, runId: collectionId, itemKey: candidate.key, ...errorContext(error) });
      }
      if (start?.state === "acquired") await heartbeatCollectorRun(this.client, start.lease);
    }

    summary.finishedAt = new Date().toISOString();
    if (start?.state === "acquired") {
      const status = summary.errors.length === 0 ? "SUCCESS" : summary.downloaded > 0 ? "PARTIAL" : "FAILED";
      await finishCollectorRun(this.client, start.lease, {
        status, found: summary.found,
        created: summary.editaisCreated + summary.provasCreated + summary.gabaritosCreated + summary.resultadosCreated + summary.cutoffsCreated,
        unchanged: summary.duplicateFiles, rejected: summary.failed, errorCount: summary.errors.length,
        error: summary.errors.length ? new Error(summary.errors.map((item) => `${item.key}: ${item.message}`).join(" | ")) : undefined,
        metadata: {
          bucket: BUCKET, downloaded: summary.downloaded, uploaded: summary.uploaded, duplicates: summary.duplicateFiles,
          searchProvider: summary.searchProvider,
          extracted: summary.extracted, partial: summary.partial, scanned: summary.scanned, failed: summary.failed,
          discoveredByExa: summary.discoveredByExa, discoveryContestsSearched: summary.discoveryContestsSearched,
          discoveryCatalogTotal: summary.discoveryCatalogTotal, discoveryCatalogOffset: summary.discoveryCatalogOffset,
          discoveryResultsFound: summary.discoveryResultsFound, discoveryRejected: summary.discoveryRejected,
          resultadosCreated: summary.resultadosCreated, cutoffsCreated: summary.cutoffsCreated,
        },
      });
    }
    this.stats = summary;
    return summary;
  }
}

export async function runDocumentCollection(options: DocumentCollectionOptions = {}) {
  if (options.dryRun && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para a simulação.");
    const readOnlyClient = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    return new DocumentCollector(readOnlyClient).run(options);
  }
  return new DocumentCollector().run(options);
}
