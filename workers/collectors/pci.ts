import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PciConcursosProvider } from "../../src/lib/providers/concursos/pci";
import { comparisonText, deduplicateContests } from "../../src/lib/providers/concursos/pci-transform";
import type { NormalizedContest } from "../../src/lib/providers/concursos/types";
import { errorContext, operationalLog } from "../../src/lib/operations/logger";
import { beginCollectorRun, finishCollectorRun, heartbeatCollectorRun } from "../lib/collector-runtime";

type ExistingContest = {
  id: string;
  external_id: string;
  titulo: string;
  status: string;
  vagas_total: number | null;
  salario_min: number | null;
  salario_max: number | null;
  inicio_inscricoes: string | null;
  fim_inscricoes: string | null;
  deduplication_key: string | null;
};

const SUPPLEMENTAL_CATALOG_QUERIES = [
  "Banco do Brasil",
  "Caixa Econômica Federal",
  "BNDES",
  "Banco do Nordeste",
  "Banco da Amazônia",
  "BRB",
  "Banrisul",
  "Banco Central",
] as const;

export function resolvePciSupplementalQueryLimit(value = process.env.PCI_SUPPLEMENTAL_QUERY_LIMIT): number {
  const configured = Number(value?.trim() || SUPPLEMENTAL_CATALOG_QUERIES.length);
  return Math.min(Math.max(configured, 0), SUPPLEMENTAL_CATALOG_QUERIES.length);
}

export function resolvePciSanityLimit(value = process.env.PCI_SANITY_MAX_ITEMS): number {
  const configured = Number(value?.trim() || 2500);
  return Math.min(Math.max(configured, 100), 10_000);
}

export interface CollectionSummary {
  found: number;
  normalized: number;
  discarded: number;
  unique: number;
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
  collectionId: string | null;
  outcome: "completed" | "disabled" | "already_running";
}

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente do collector.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function slugify(value: string): string {
  return comparisonText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "registro";
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function contentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function chunks<T>(items: T[], size = 150): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function asNumber(value: number | null): number | null {
  return value === null ? null : Number(value);
}

function importantChanges(previous: ExistingContest, next: NormalizedContest): string[] {
  const changes: string[] = [];
  if (previous.fim_inscricoes !== next.registrationEnd) changes.push(`fim das inscrições: ${previous.fim_inscricoes ?? "não informado"} → ${next.registrationEnd ?? "não informado"}`);
  if (previous.inicio_inscricoes !== next.registrationStart) changes.push(`início das inscrições: ${previous.inicio_inscricoes ?? "não informado"} → ${next.registrationStart ?? "não informado"}`);
  if (asNumber(previous.salario_min) !== next.salaryMin || asNumber(previous.salario_max) !== next.salaryMax) changes.push("remuneração alterada");
  if (previous.vagas_total !== next.vacancies) changes.push(`vagas: ${previous.vagas_total ?? "não informado"} → ${next.vacancies ?? "não informado"}`);
  if (next.status && previous.status !== next.status) changes.push(`status: ${previous.status} → ${next.status}`);
  return changes;
}

function movementTitle(changes: string[]): string {
  if (changes.length === 1 && changes[0].startsWith("fim das inscrições")) return "Prazo de inscrição alterado";
  if (changes.length === 1 && changes[0] === "remuneração alterada") return "Remuneração alterada";
  if (changes.length === 1 && changes[0].startsWith("vagas:")) return "Número de vagas alterado";
  if (changes.length === 1 && changes[0].startsWith("status:")) return "Status alterado";
  return "Dados do concurso atualizados";
}

async function fetchExisting(client: SupabaseClient, externalIds: string[]): Promise<Map<string, ExistingContest>> {
  const result = new Map<string, ExistingContest>();
  for (const group of chunks(externalIds)) {
    const { data, error } = await client.from("concursos")
      .select("id, external_id, titulo, status, vagas_total, salario_min, salario_max, inicio_inscricoes, fim_inscricoes, deduplication_key")
      .eq("provider", "pci_mcp").in("external_id", group);
    if (error) throw error;
    for (const row of data as ExistingContest[]) result.set(row.external_id, row);
  }
  return result;
}

async function persistCatalog(client: SupabaseClient, contests: NormalizedContest[]) {
  const { data: source, error: sourceError } = await client.from("fontes").upsert({
    nome: "PCI Concursos", dominio: "pciconcursos.com.br", tipo: "SPECIALIZED", official: false, reliability_score: 0.7,
  }, { onConflict: "dominio,tipo" }).select("id").single();
  if (sourceError) throw sourceError;

  const organizations = [...new Map(contests.map((item) => {
    const slug = `${slugify(item.organization)}-${(item.state ?? "br").toLowerCase()}`;
    return [slug, { nome: item.organization, sigla: item.organizationAcronym, slug, tipo: "OUTRO", uf: item.state, cidade: item.city }];
  })).values()];
  for (const group of chunks(organizations)) {
    const { error } = await client.from("orgaos").upsert(group, { onConflict: "slug" });
    if (error) throw error;
  }
  const organizationIds = new Map<string, string>();
  for (const group of chunks(organizations.map((item) => item.slug))) {
    const { data, error } = await client.from("orgaos").select("id,slug").in("slug", group);
    if (error) throw error;
    for (const row of data) organizationIds.set(row.slug, row.id);
  }

  const roles = [...new Map(contests.flatMap((item) => item.roles).map((name) => {
    const slug = `${slugify(name)}-${shortHash(comparisonText(name))}`;
    return [slug, { nome: name, slug }];
  })).values()];
  for (const group of chunks(roles)) {
    const { error } = await client.from("cargos").upsert(group, { onConflict: "slug" });
    if (error) throw error;
  }
  const roleIds = new Map<string, string>();
  for (const group of chunks(roles.map((item) => item.slug))) {
    const { data, error } = await client.from("cargos").select("id,slug").in("slug", group);
    if (error) throw error;
    for (const row of data) roleIds.set(row.slug, row.id);
  }

  const existing = await fetchExisting(client, contests.map((item) => item.externalId));
  const newItems = contests.filter((item) => !existing.has(item.externalId));
  const changed = contests.flatMap((item) => {
    const previous = existing.get(item.externalId);
    if (!previous) return [];
    const changes = importantChanges(previous, item);
    return changes.length || previous.titulo !== item.title || previous.deduplication_key !== item.deduplicationKey ? [{ item, previous, changes }] : [];
  });

  const toRow = (item: NormalizedContest) => {
    const orgSlug = `${slugify(item.organization)}-${(item.state ?? "br").toLowerCase()}`;
    const orgId = organizationIds.get(orgSlug);
    if (!orgId) throw new Error(`Órgão não persistido: ${item.organization}`);
    return {
      slug: `${slugify(item.title)}-${(item.state ?? "br").toLowerCase()}-${item.externalId}`,
      titulo: item.title,
      orgao_id: orgId,
      status: item.status ?? "PREVISTO",
      confidence: "MEDIUM",
      uf: item.state,
      cidade: item.city,
      regiao: item.region,
      vagas_total: item.vacancies,
      salario_min: item.salaryMin,
      salario_max: item.salaryMax,
      escolaridade_resumo: item.education,
      inicio_inscricoes: item.registrationStart,
      fim_inscricoes: item.registrationEnd,
      provider: "pci_mcp",
      external_id: item.externalId,
      deduplication_key: item.deduplicationKey,
      raw_metadata: item.rawMetadata,
    };
  };

  for (const group of chunks(newItems.map(toRow))) {
    const { error } = await client.from("concursos").insert(group);
    if (error) throw error;
  }
  for (const group of chunks(changed.map(({ item }) => toRow(item)))) {
    const { error } = await client.from("concursos").upsert(group, { onConflict: "provider,external_id" });
    if (error) throw error;
  }

  const persisted = await fetchExisting(client, contests.map((item) => item.externalId));
  const byContestId = new Map(contests.map((item) => [persisted.get(item.externalId)?.id, item]).filter((entry): entry is [string, NormalizedContest] => Boolean(entry[0])));

  const contestRoles = contests.flatMap((item) => {
    const contestId = persisted.get(item.externalId)?.id;
    if (!contestId) return [];
    return item.roles.flatMap((name) => {
      const roleId = roleIds.get(`${slugify(name)}-${shortHash(comparisonText(name))}`);
      return roleId ? [{ concurso_id: contestId, cargo_id: roleId }] : [];
    });
  });
  for (const group of chunks(contestRoles)) {
    const { error } = await client.from("concursos_cargos").upsert(group, { onConflict: "concurso_id,cargo_id", ignoreDuplicates: true });
    if (error) throw error;
  }

  const sourceRows = contests.flatMap((item) => {
    const contestId = persisted.get(item.externalId)?.id;
    return contestId ? [{ concurso_id: contestId, fonte_id: source.id, url: item.source.sourceUrl, titulo: item.title, collected_at: item.source.collectedAt, content_hash: contentHash(item.rawMetadata), confidence: "MEDIUM", is_primary: true, raw_metadata: item.rawMetadata }] : [];
  });
  for (const group of chunks(sourceRows)) {
    const { error } = await client.from("concurso_fontes").upsert(group, { onConflict: "concurso_id,url,content_hash", ignoreDuplicates: true });
    if (error) throw error;
  }

  const today = new Date().toISOString().slice(0, 10);
  const movementSeeds = [
    ...newItems.flatMap((item) => {
      const id = persisted.get(item.externalId)?.id;
      return id ? [{ concurso_id: id, tipo: "COLETA_INICIAL", titulo: "Concurso coletado no PCI", descricao: "Primeiro registro desta oportunidade na base do Radar.", status_novo: item.status, event_date: today, confidence: "MEDIUM" }] : [];
    }),
    ...changed.filter(({ changes }) => changes.length).flatMap(({ item, previous, changes }) => {
      const id = persisted.get(item.externalId)?.id;
      return id ? [{ concurso_id: id, tipo: "DADOS_ALTERADOS", titulo: movementTitle(changes), descricao: changes.join("; "), status_anterior: previous.status, status_novo: item.status, event_date: today, confidence: "MEDIUM" }] : [];
    }),
  ];
  for (const group of chunks(movementSeeds)) {
    const { data, error } = await client.from("movimentacoes").insert(group).select("id,concurso_id");
    if (error) throw error;
    const links = data.flatMap((movement) => {
      const item = byContestId.get(movement.concurso_id);
      return item ? [{ movimentacao_id: movement.id, fonte_id: source.id, url: item.source.sourceUrl }] : [];
    });
    if (links.length) {
      const { error: linkError } = await client.from("movimentacao_fontes").upsert(links, { onConflict: "movimentacao_id,url", ignoreDuplicates: true });
      if (linkError) throw linkError;
    }
  }

  return { created: newItems.length, updated: changed.length, unchanged: contests.length - newItems.length - changed.length };
}

export async function runPciCollection(options: { client?: SupabaseClient; provider?: PciConcursosProvider } = {}): Promise<CollectionSummary> {
  const client = options.client ?? adminClient();
  const provider = options.provider ?? new PciConcursosProvider();
  const start = await beginCollectorRun(client, "pci_collector", "pci_mcp", { transport: "streamable-http" });
  if (start.state !== "acquired") {
    return { found: 0, normalized: 0, discarded: 0, unique: 0, created: 0, updated: 0, unchanged: 0, errors: 0, collectionId: null, outcome: start.state };
  }
  const { lease } = start;

  try {
    const broadCatalog = await provider.list();
    const broadStats = provider.lastCallStats;
    const supplementalLimit = resolvePciSupplementalQueryLimit();
    const collected = [...broadCatalog];
    let received = broadStats.received;
    let normalized = broadStats.normalized;
    let discarded = broadStats.discarded;
    const supplementalErrors: string[] = [];
    for (const query of SUPPLEMENTAL_CATALOG_QUERIES.slice(0, supplementalLimit)) {
      try {
        const results = await provider.search({ query });
        const queryStats = provider.lastCallStats;
        collected.push(...results);
        received += queryStats.received;
        normalized += queryStats.normalized;
        discarded += queryStats.discarded;
      } catch (error) {
        supplementalErrors.push(`${query}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const contests = deduplicateContests(collected);
    const stats = { received, normalized, discarded, unique: contests.length };
    const sanityLimit = resolvePciSanityLimit();
    if (stats.received > sanityLimit) throw Object.assign(new Error(`O PCI retornou ${stats.received} itens; limite de segurança: ${sanityLimit}.`), { code: "SANITY_LIMIT" });
    await heartbeatCollectorRun(client, lease);
    const persisted = await persistCatalog(client, contests);
    const summary: CollectionSummary = { found: stats.received, normalized: stats.normalized, discarded: stats.discarded, unique: stats.unique, ...persisted, errors: supplementalErrors.length, collectionId: lease.runId, outcome: "completed" };
    await finishCollectorRun(client, lease, {
      status: supplementalErrors.length ? "PARTIAL" : "SUCCESS", found: summary.found, created: summary.created, updated: summary.updated,
      unchanged: summary.unchanged, rejected: summary.discarded,
      errorCount: supplementalErrors.length,
      error: supplementalErrors.length ? new Error(supplementalErrors.join(" | ")) : undefined,
      metadata: { normalized: summary.normalized, unique: summary.unique, supplementalQueries: supplementalLimit, transport: "streamable-http" },
    });
    return summary;
  } catch (error) {
    await finishCollectorRun(client, lease, { status: "FAILED", error });
    operationalLog("error", "collector.unhandled_error", { collector: lease.collector, runId: lease.runId, ...errorContext(error) });
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runPciCollection().then((summary) => console.info(JSON.stringify(summary, null, 2))).catch(() => process.exitCode = 1);
}
