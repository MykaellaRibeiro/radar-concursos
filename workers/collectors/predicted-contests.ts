import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BANKING_DISCOVERY_QUERIES, DISCOVERY_QUERIES, OFFICIAL_CONFIRMATION_DOMAINS } from "../../src/lib/discovery/config";
import { extractDiscovery, type OrganizationCandidate } from "../../src/lib/discovery/extractor";
import { matchExistingContest } from "../../src/lib/discovery/contest-matcher";
import { buildEventFingerprint } from "../../src/lib/discovery/fingerprint";
import { confidenceForEvidence, sourceDisplayName } from "../../src/lib/discovery/source-ranking";
import { shouldAdvanceStatus } from "../../src/lib/discovery/status-ranking";
import type { ExtractedDiscovery, SourceTier } from "../../src/lib/discovery/types";
import { ExaSearchProvider } from "../../src/lib/providers/search/exa";
import type { SearchProvider, SearchResult } from "../../src/lib/providers/search/types";
import { normalizeEntityName } from "../../src/lib/utils/normalization";
import { regionFromUf } from "../../src/lib/utils/geography";
import type { ConfidenceLevel, ConcursoStatus } from "../../src/types/domain";
import { errorContext, operationalLog } from "../../src/lib/operations/logger";
import { beginCollectorRun, finishCollectorRun, heartbeatCollectorRun } from "../lib/collector-runtime";

const confidenceRank: Record<ConfidenceLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, OFFICIAL: 4 };

type DbOrganization = { id: string; nome: string; sigla: string | null; uf: string | null; cidade: string | null };
type DbContest = { id: string; orgao_id: string; titulo: string; slug: string; status: ConcursoStatus; confidence: ConfidenceLevel; uf: string | null; cidade: string | null; regiao: string | null; escolaridade_resumo: string | null; salario_max: number | null; vagas_previstas: number | null; banca_status: "PROVAVEL" | "DEFINIDA" | "CONTRATADA" | null; banca_observacao: string | null };

interface AcceptedGroup {
  fingerprint: string;
  contest: DbContest;
  event: ExtractedDiscovery;
  evidence: ExtractedDiscovery[];
  confidence: ConfidenceLevel;
}

interface PotentialNewGroup {
  fingerprint: string;
  organizationName: string;
  organizationAcronym: string | null;
  uf: string | null;
  event: ExtractedDiscovery;
  evidence: ExtractedDiscovery[];
  confidence: ConfidenceLevel;
  eligible: boolean;
}

export interface PredictedCollectionSummary {
  dryRun: boolean;
  queriesAttempted: number;
  queryErrors: number;
  confirmationQueriesAttempted: number;
  officialConfirmationsFound: number;
  found: number;
  unique: number;
  accepted: number;
  relevant: number;
  rejected: number;
  matchedExistingContests: number;
  potentialNewContests: number;
  eligibleNewContests: number;
  duplicates: number;
  contestsCreated: number;
  movementsCreated: number;
  movementsUpdated: number;
  contestsUpdated: number;
  evidenceLinked: number;
  sourcesAdded: number;
  notificationsCreated: number;
  collectionId: string | null;
  preview: Array<{ contest: string; event: string; confidence: ConfidenceLevel; sources: number; date: string }>;
  potentialNewPreview: Array<{ organization: string; uf: string | null; event: string; confidence: ConfidenceLevel; sources: number; eligible: boolean }>;
  rejectedPreview: Array<{ title: string; domain: string; event: string | null; reason: string }>;
  rejectionReasons: Record<string, number>;
  errors: string[];
  outcome: "completed" | "disabled" | "already_running";
}

type PredictedCollectionOptions = { client?: SupabaseClient; provider?: SearchProvider; dryRun?: boolean; queries?: readonly string[] };

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente do coletor.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function collectionClient(dryRun: boolean): SupabaseClient {
  if (dryRun && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para a simulação.");
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return adminClient();
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sourceType(tier: SourceTier) {
  if (tier === "OFFICIAL") return "OFFICIAL";
  if (tier === "EXAM_BOARD") return "EXAM_BOARD";
  if (tier === "NEWS") return "NEWS";
  if (tier === "SPECIALIZED" || tier === "SPECIALIZED_HIGH") return "SPECIALIZED";
  return "OTHER";
}

function sourceScore(tier: SourceTier) {
  return { OFFICIAL: 1, EXAM_BOARD: 0.9, SPECIALIZED_HIGH: 0.82, SPECIALIZED: 0.7, NEWS: 0.55, OTHER: 0.35 }[tier];
}

function eventTitle(event: NonNullable<ExtractedDiscovery["eventType"]>) {
  const labels: Record<typeof event, string> = {
    CONCURSO_SOLICITADO: "Novo concurso solicitado", CONCURSO_ANUNCIADO: "Novo concurso anunciado",
    CONCURSO_PREVISTO: "Concurso previsto", CONCURSO_AUTORIZADO: "Concurso autorizado",
    GRUPO_TRABALHO: "Grupo de trabalho instituído", COMISSAO_FORMADA: "Comissão organizadora formada",
    BANCA_EM_DEFINICAO: "Banca em definição", BANCA_DEFINIDA: "Banca definida", BANCA_CONTRATADA: "Banca contratada",
    PROJETO_BASICO: "Projeto básico divulgado", EDITAL_EM_ELABORACAO: "Edital em elaboração",
    EDITAL_IMINENTE: "Edital iminente", EDITAL_PUBLICADO: "Edital publicado", RETIFICACAO: "Edital retificado",
    VAGAS_ALTERADAS: "Quantidade de vagas alterada", SALARIO_ALTERADO: "Remuneração alterada",
    INSCRICOES_ABERTAS: "Inscrições abertas", INSCRICOES_PRORROGADAS: "Inscrições prorrogadas",
    INSCRICOES_ENCERRADAS: "Inscrições encerradas", DATA_PROVA_ALTERADA: "Data da prova alterada",
    LOCAL_PROVA: "Locais de prova divulgados", PROVA_REALIZADA: "Prova realizada", GABARITO_PUBLICADO: "Gabarito publicado",
    RESULTADO_PRELIMINAR: "Resultado preliminar publicado", RESULTADO_DEFINITIVO: "Resultado definitivo publicado",
    HOMOLOGACAO: "Concurso homologado", CONVOCACAO: "Convocação publicada", NOMEACAO: "Nomeação publicada",
  };
  return labels[event];
}

async function loadCatalog(client: SupabaseClient, allowMissingAliases = false) {
  const [{ data: organizations, error: orgError }, { data: aliases, error: aliasError }, { data: contests, error: contestError }] = await Promise.all([
    client.from("orgaos").select("id,nome,sigla,uf,cidade"),
    client.from("orgao_aliases").select("orgao_id,alias"),
    client.from("concursos").select("id,orgao_id,titulo,slug,status,confidence,uf,cidade,regiao,escolaridade_resumo,salario_max,vagas_previstas,banca_status,banca_observacao"),
  ]);
  if (orgError) throw orgError;
  if (aliasError && !allowMissingAliases) throw aliasError;
  if (contestError) throw contestError;
  const aliasMap = new Map<string, string[]>();
  for (const row of aliases ?? []) aliasMap.set(row.orgao_id, [...(aliasMap.get(row.orgao_id) ?? []), row.alias]);
  const candidates: OrganizationCandidate[] = (organizations as DbOrganization[]).map((organization) => ({
    id: organization.id, name: organization.nome, acronym: organization.sigla, uf: organization.uf, city: organization.cidade,
    aliases: aliasMap.get(organization.id) ?? [],
  }));
  return { organizations: organizations as DbOrganization[], candidates, contests: contests as DbContest[] };
}

function makeGroups(extracted: ExtractedDiscovery[], catalog: Awaited<ReturnType<typeof loadCatalog>>) {
  const groups = new Map<string, AcceptedGroup>();
  const potential = new Map<string, PotentialNewGroup>();

  for (const event of extracted) {
    if (event.rejectionReason || !event.eventType || !event.orgaoName) continue;
    if (!event.orgaoId) {
      if (!event.result.publishedAt) {
        event.rejectionReason = "missing_event_date";
        continue;
      }
      const fingerprint = buildEventFingerprint({ orgao: event.orgaoAcronym ?? event.orgaoName, uf: event.uf, eventType: event.eventType, eventDate: event.eventDate });
      const current = potential.get(fingerprint);
      if (current) current.evidence.push(event);
      else potential.set(fingerprint, { fingerprint, organizationName: event.orgaoName, organizationAcronym: event.orgaoAcronym, uf: event.uf, event, evidence: [event], confidence: event.confidence, eligible: false });
      continue;
    }
    const match = matchExistingContest({ organizationId: event.orgaoId, uf: event.uf, text: `${event.result.title}\n${event.result.snippet ?? ""}` }, catalog.contests);
    if (!match) {
      event.rejectionReason = "ambiguous";
      continue;
    }
    const contest = match.contest as DbContest;
    const fingerprint = buildEventFingerprint({ orgao: event.orgaoAcronym ?? event.orgaoName, uf: event.uf, eventType: event.eventType, eventDate: event.eventDate });
    const current = groups.get(fingerprint);
    if (current) current.evidence.push(event);
    else groups.set(fingerprint, { fingerprint, contest, event, evidence: [event], confidence: event.confidence });
  }

  for (const group of groups.values()) {
    const independentEvidence = [...new Map(group.evidence.map((item) => [sourceDisplayName(item.result.domain), item.sourceTier])).values()];
    group.confidence = confidenceForEvidence(independentEvidence);
    for (const evidence of group.evidence) evidence.confidence = group.confidence;
  }
  const potentialGroups = [...potential.values()];
  for (const unknownLocation of potentialGroups.filter((group) => !group.uf)) {
    const compatible = potentialGroups.filter((candidate) => candidate !== unknownLocation
      && candidate.uf
      && normalizeEntityName(candidate.organizationName) === normalizeEntityName(unknownLocation.organizationName)
      && candidate.event.eventType === unknownLocation.event.eventType);
    if (compatible.length === 1) {
      compatible[0].evidence.push(...unknownLocation.evidence);
      potential.delete(unknownLocation.fingerprint);
    }
  }
  for (const group of potential.values()) {
    const legalEvidence = group.evidence.find((item) => item.orgaoLegalName);
    if (legalEvidence?.orgaoLegalName && legalEvidence.orgaoName) {
      group.organizationName = legalEvidence.orgaoLegalName;
      group.organizationAcronym = legalEvidence.orgaoName.toUpperCase();
    }
    const evidenceByDomain = [...new Map(group.evidence.map((item) => [sourceDisplayName(item.result.domain), item])).values()];
    group.confidence = confidenceForEvidence(evidenceByDomain.map((item) => item.sourceTier));
    const strongDomains = evidenceByDomain.filter((item) => item.sourceTier === "EXAM_BOARD" || item.sourceTier === "SPECIALIZED_HIGH").length;
    group.eligible = evidenceByDomain.some((item) => item.sourceTier === "OFFICIAL") || strongDomains >= 2;
    if (!group.eligible) for (const evidence of group.evidence) evidence.rejectionReason = "insufficient_evidence";
  }
  return { existing: [...groups.values()], potential: [...potential.values()] };
}

async function ensureSource(client: SupabaseClient, evidence: ExtractedDiscovery) {
  const row = {
    nome: sourceDisplayName(evidence.result.domain),
    dominio: evidence.result.domain,
    tipo: sourceType(evidence.sourceTier),
    ranking_tier: evidence.sourceTier,
    official: evidence.sourceTier === "OFFICIAL",
    reliability_score: sourceScore(evidence.sourceTier),
  };
  const { data: current, error: currentError } = await client.from("fontes").select("id").eq("dominio", row.dominio).eq("tipo", row.tipo).maybeSingle();
  if (currentError) throw currentError;
  if (current) {
    const { error: updateError } = await client.from("fontes").update({ nome: row.nome, ranking_tier: row.ranking_tier, official: row.official, reliability_score: row.reliability_score }).eq("id", current.id);
    if (updateError) throw updateError;
    return { id: current.id as string, created: false };
  }
  const { data, error } = await client.from("fontes").insert(row).select("id").single();
  if (error) throw error;
  return { id: data.id as string, created: true };
}

function slugify(value: string) {
  return normalizeEntityName(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 75) || "concurso";
}

async function ensureNewContest(client: SupabaseClient, group: PotentialNewGroup): Promise<{ contest: DbContest; created: boolean }> {
  const orgSlug = `${slugify(group.organizationName)}-${(group.uf ?? "br").toLowerCase()}`;
  const region = regionFromUf(group.uf);
  const officialEvidence = group.evidence.find((evidence) => evidence.sourceTier === "OFFICIAL");
  const { data: organization, error: orgError } = await client.from("orgaos").upsert({
    nome: group.organizationName, sigla: group.organizationAcronym, slug: orgSlug, tipo: "OUTRO", uf: group.uf,
    site_oficial: officialEvidence?.result.url,
  }, { onConflict: "slug" }).select("id,nome,sigla,uf,cidade").single();
  if (orgError) throw orgError;
  const status = group.event.status ?? "PREVISTO";
  const contestSlug = `concurso-${orgSlug}-${group.event.eventDate.slice(0, 4)}`;
  const deduplicationKey = sha256([organization.id, group.uf ?? "", group.event.eventType, group.event.eventDate.slice(0, 4)].join("|"));
  const externalId = group.fingerprint.slice(0, 24);
  const { data: existing, error: existingError } = await client.from("concursos").select("id").eq("provider", "web_discovery").eq("external_id", externalId).maybeSingle();
  if (existingError) throw existingError;
  const { data: contest, error: contestError } = await client.from("concursos").upsert({
    slug: contestSlug, titulo: `Concurso ${group.organizationName}`, orgao_id: organization.id, status,
    confidence: group.confidence, uf: group.uf, regiao: region, vagas_previstas: group.event.vacancies, provider: "web_discovery",
    external_id: externalId, deduplication_key: deduplicationKey,
    raw_metadata: { discoveredBy: "exa", firstSeenAt: group.event.result.retrievedAt },
  }, { onConflict: "provider,external_id" }).select("id,orgao_id,titulo,slug,status,confidence,uf,cidade,regiao,escolaridade_resumo,salario_max,vagas_previstas,banca_status,banca_observacao").single();
  if (contestError) throw contestError;
  const { error: aliasError } = await client.from("orgao_aliases").upsert({ orgao_id: organization.id, alias: group.organizationName, normalized_alias: normalizeEntityName(group.organizationName), source: "WEB_DISCOVERY" }, { onConflict: "orgao_id,normalized_alias", ignoreDuplicates: true });
  if (aliasError) throw aliasError;
  return { contest: contest as DbContest, created: !existing };
}

async function createNotifications(client: SupabaseClient, group: AcceptedGroup, movementId: string) {
  const [{ data: follows, error }, { data: alerts, error: alertError }] = await Promise.all([
    client.from("concursos_seguidos").select("user_id").eq("concurso_id", group.contest.id),
    client.from("alertas").select("id,user_id,uf,cidade,regiao,orgao_id,area,escolaridade,salario_min,banca_id,cargo_id,status_filter").eq("active", true),
  ]);
  if (error) throw error;
  if (alertError) throw alertError;
  const recipients = new Set<string>();
  for (const follow of follows ?? []) recipients.add(follow.user_id);
  for (const alert of alerts ?? []) {
    const statusMatches = !alert.status_filter?.length || (group.event.status && alert.status_filter.includes(group.event.status));
    const match = statusMatches
      && (!alert.uf || alert.uf === group.contest.uf)
      && (!alert.cidade || normalizeEntityName(alert.cidade) === normalizeEntityName(group.contest.cidade ?? ""))
      && (!alert.regiao || normalizeEntityName(alert.regiao) === normalizeEntityName(group.contest.regiao ?? ""))
      && (!alert.orgao_id || alert.orgao_id === group.contest.orgao_id)
      && (!alert.escolaridade || normalizeEntityName(group.contest.escolaridade_resumo ?? "").includes(normalizeEntityName(alert.escolaridade)))
      && (!alert.salario_min || (group.contest.salario_max ?? 0) >= Number(alert.salario_min))
      && !alert.area && !alert.banca_id && !alert.cargo_id;
    if (match) recipients.add(alert.user_id);
  }
  let created = 0;
  for (const userId of recipients) {
    const key = `movement:${movementId}:user:${userId}`;
    const { data: present } = await client.from("notificacoes").select("id").eq("deduplication_key", key).maybeSingle();
    if (present) continue;
    const { error: insertError } = await client.from("notificacoes").insert({
      user_id: userId, concurso_id: group.contest.id, movimentacao_id: movementId,
      titulo: eventTitle(group.event.eventType!), mensagem: `Há uma nova movimentação verificada em ${group.contest.titulo}.`, deduplication_key: key,
    });
    if (insertError) throw insertError;
    created += 1;
  }
  return created;
}

async function persistGroup(client: SupabaseClient, group: AcceptedGroup) {
  const { data: existing, error: existingError } = await client.from("movimentacoes")
    .select("id,confidence").eq("event_fingerprint", group.fingerprint).maybeSingle();
  if (existingError) throw existingError;
  let movementId: string;
  let created = 0;
  let updated = 0;
  if (existing) {
    movementId = existing.id;
    if (confidenceRank[group.confidence] > confidenceRank[existing.confidence as ConfidenceLevel]) {
      const { error } = await client.from("movimentacoes").update({ confidence: group.confidence }).eq("id", movementId);
      if (error) throw error;
      updated = 1;
    }
  } else {
    const { data, error } = await client.from("movimentacoes").insert({
      concurso_id: group.contest.id, tipo: group.event.eventType, titulo: eventTitle(group.event.eventType!),
      descricao: group.event.result.snippet?.slice(0, 500) ?? null, status_anterior: group.contest.status,
      status_novo: group.event.status, event_date: group.event.eventDate, occurred_at: group.event.result.publishedAt,
      confidence: group.confidence, event_fingerprint: group.fingerprint,
      metadata: { provider: "exa", board: group.event.boardName, vacancies: group.event.vacancies },
    }).select("id").single();
    if (error) throw error;
    movementId = data.id;
    created = 1;
  }

  let evidenceLinked = 0;
  let sourcesAdded = 0;
  for (const evidence of group.evidence) {
    const source = await ensureSource(client, evidence);
    const sourceId = source.id;
    if (source.created) sourcesAdded += 1;
    const contentHash = sha256(`${evidence.result.title}\n${evidence.result.snippet ?? ""}`);
    const { data: existingLink, error: existingLinkError } = await client.from("movimentacao_fontes").select("id").eq("movimentacao_id", movementId).eq("url", evidence.result.url).maybeSingle();
    if (existingLinkError) throw existingLinkError;
    const { error: linkError } = await client.from("movimentacao_fontes").upsert({
      movimentacao_id: movementId, fonte_id: sourceId, url: evidence.result.url, titulo: evidence.result.title,
      published_at: evidence.result.publishedAt, content_hash: contentHash, confidence: group.confidence,
      metadata: { provider: evidence.result.provider, sourceTier: evidence.sourceTier },
    }, { onConflict: "movimentacao_id,url", ignoreDuplicates: true });
    if (linkError) throw linkError;
    if (!existingLink) evidenceLinked += 1;
    const { error: contestSourceError } = await client.from("concurso_fontes").upsert({
      concurso_id: group.contest.id, fonte_id: sourceId, url: evidence.result.url, titulo: evidence.result.title,
      published_at: evidence.result.publishedAt, content_hash: contentHash, confidence: group.confidence,
      is_primary: evidence.sourceTier === "OFFICIAL", raw_metadata: { provider: "exa", sourceTier: evidence.sourceTier },
    }, { onConflict: "concurso_id,url,content_hash", ignoreDuplicates: true });
    if (contestSourceError) throw contestSourceError;
  }

  const contestUpdate: Record<string, unknown> = {};
  if (shouldAdvanceStatus(group.contest.status, group.event.status)) contestUpdate.status = group.event.status;
  if (confidenceRank[group.confidence] > confidenceRank[group.contest.confidence]) contestUpdate.confidence = group.confidence;
  if (group.contest.vagas_previstas === null && group.event.vacancies !== null) contestUpdate.vagas_previstas = group.event.vacancies;
  if (group.event.boardName && ["BANCA_DEFINIDA", "BANCA_CONTRATADA"].includes(group.event.eventType!)) {
    const nextBoardStatus = group.event.eventType === "BANCA_CONTRATADA" ? "CONTRATADA" : "DEFINIDA";
    if (group.contest.banca_status !== nextBoardStatus) contestUpdate.banca_status = nextBoardStatus;
    if (group.contest.banca_observacao !== group.event.boardName) contestUpdate.banca_observacao = group.event.boardName;
  }
  let contestUpdated = 0;
  if (Object.keys(contestUpdate).length) {
    const { error } = await client.from("concursos").update(contestUpdate).eq("id", group.contest.id);
    if (error) throw error;
    contestUpdated = 1;
  }
  const notifications = created ? await createNotifications(client, group, movementId) : 0;
  return { created, updated, contestUpdated, evidenceLinked, sourcesAdded, notifications };
}

async function executePredictedCollection(options: PredictedCollectionOptions = {}): Promise<PredictedCollectionSummary> {
  const dryRun = options.dryRun ?? false;
  const client = options.client ?? collectionClient(dryRun);
  const provider = options.provider ?? new ExaSearchProvider();
  const configuredQueries = options.queries ?? DISCOVERY_QUERIES;
  const queryLimit = Math.min(Math.max(Number(process.env.DISCOVERY_QUERY_LIMIT ?? configuredQueries.length), 1), configuredQueries.length);
  const bankingQueryLimit = options.queries
    ? 0
    : Math.min(Math.max(Number(process.env.DISCOVERY_BANKING_QUERY_LIMIT ?? BANKING_DISCOVERY_QUERIES.length), 0), BANKING_DISCOVERY_QUERIES.length);
  const recentQueries = configuredQueries.slice(0, queryLimit);
  const bankingQueries = BANKING_DISCOVERY_QUERIES.slice(0, bankingQueryLimit);
  const queries = [...recentQueries, ...bankingQueries];
  const limit = Math.min(Math.max(Number(process.env.DISCOVERY_RESULTS_PER_QUERY ?? 5), 1), 8);
  const catalog = await loadCatalog(client, dryRun && !process.env.SUPABASE_SERVICE_ROLE_KEY);
  const results: SearchResult[] = [];
  const errors: string[] = [];
  for (const query of queries) {
    try {
      const queryResults = bankingQueries.includes(query as (typeof BANKING_DISCOVERY_QUERIES)[number])
        ? await provider.search(query, {
            limit,
            objective: "Localizar concursos públicos bancários verificáveis, inclusive históricos, priorizando o banco, a banca e documentos oficiais.",
          })
        : await provider.searchRecent(query, 7, { limit });
      results.push(...queryResults.map((result) => ({ ...result, metadata: { ...result.metadata, query } })));
    } catch (error) {
      errors.push(`${query}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (query !== queries.at(-1)) await wait(Number(process.env.DISCOVERY_QUERY_DELAY_MS ?? 650));
  }
  if (!results.length && errors.length) throw new Error(`Nenhuma consulta Exa foi concluída. ${errors.join(" | ")}`);
  let uniqueResults = [...new Map(results.map((result) => [result.url, result])).values()];
  let extracted = uniqueResults.map((result) => extractDiscovery(result, catalog.candidates));
  let analysis = makeGroups(extracted, catalog);
  let eligiblePotential = analysis.potential.filter((group) => group.eligible);
  let confirmationQueriesAttempted = 0;
  let officialConfirmationsFound = 0;
  const confirmationEnabled = !/^(?:0|false|off)$/i.test(process.env.DISCOVERY_CONFIRM_OFFICIAL ?? "true");
  const confirmationLimit = Math.min(Math.max(Number(process.env.DISCOVERY_CONFIRMATION_LIMIT ?? 2), 0), 5);
  if (confirmationEnabled && confirmationLimit > 0) {
    for (const group of eligiblePotential.filter((candidate) => candidate.confidence !== "OFFICIAL").slice(0, confirmationLimit)) {
      confirmationQueriesAttempted += 1;
      const organizationLabel = group.event.orgaoName ?? group.organizationAcronym ?? group.organizationName;
      const query = `"${organizationLabel}" ${group.uf ?? "Brasil"} concurso ${eventTitle(group.event.eventType!)} Diário Oficial`;
      try {
        await wait(Number(process.env.DISCOVERY_QUERY_DELAY_MS ?? 650));
        const confirmations = await provider.searchDomains(query, [...OFFICIAL_CONFIRMATION_DOMAINS], {
          limit: 3,
          objective: "Confirmar em fonte oficial a mesma movimentação do concurso, sem inferir fatos ausentes.",
        });
        for (const result of confirmations) {
          const haystack = normalizeEntityName(`${result.title}\n${result.snippet ?? ""}\n${result.content ?? ""}`);
          if (!haystack.includes(normalizeEntityName(organizationLabel))) continue;
          const confirmation = extractDiscovery({ ...result, metadata: { ...result.metadata, query, confirmation: true } }, catalog.candidates);
          if (confirmation.sourceTier !== "OFFICIAL" || confirmation.eventType !== group.event.eventType) continue;
          results.push(result);
          extracted.push({
            ...confirmation,
            orgaoId: null,
            orgaoName: group.event.orgaoName,
            orgaoLegalName: group.organizationName !== group.event.orgaoName ? group.organizationName : confirmation.orgaoLegalName,
            orgaoAcronym: group.organizationAcronym,
            uf: group.uf,
            eventDate: result.publishedAt ? confirmation.eventDate : group.event.eventDate,
            rejectionReason: null,
          });
          officialConfirmationsFound += 1;
        }
      } catch (error) {
        errors.push(`${query}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (officialConfirmationsFound) {
      const extractedByUrl = new Map(extracted.map((event) => [event.result.url, event]));
      uniqueResults = [...new Map(results.map((result) => [result.url, result])).values()];
      extracted = uniqueResults.map((result) => extractedByUrl.get(result.url) ?? extractDiscovery(result, catalog.candidates));
      analysis = makeGroups(extracted, catalog);
      eligiblePotential = analysis.potential.filter((group) => group.eligible);
    }
  }
  const acceptedUrls = new Set([...analysis.existing, ...eligiblePotential].flatMap((group) => group.evidence.map((event) => event.result.url)));
  const rejected = extracted.filter((event) => !acceptedUrls.has(event.result.url));
  const rejectionReasons = rejected.reduce<Record<string, number>>((counts, event) => {
    const reason = event.rejectionReason ?? "irrelevant";
    counts[reason] = (counts[reason] ?? 0) + 1;
    return counts;
  }, {});
  const summary: PredictedCollectionSummary = {
    dryRun, queriesAttempted: queries.length, queryErrors: errors.length, confirmationQueriesAttempted, officialConfirmationsFound, found: results.length, unique: uniqueResults.length,
    relevant: extracted.filter((event) => event.eventType).length, accepted: acceptedUrls.size, rejected: rejected.length,
    matchedExistingContests: analysis.existing.length, potentialNewContests: analysis.potential.length, eligibleNewContests: eligiblePotential.length,
    duplicates: results.length - uniqueResults.length, contestsCreated: 0, movementsCreated: 0, movementsUpdated: 0, contestsUpdated: 0,
    evidenceLinked: 0, sourcesAdded: 0, notificationsCreated: 0, collectionId: null,
    preview: analysis.existing.slice(0, 30).map((group) => ({ contest: group.contest.titulo, event: group.event.eventType!, confidence: group.confidence, sources: group.evidence.length, date: group.event.eventDate })),
    potentialNewPreview: analysis.potential.slice(0, 20).map((group) => ({ organization: group.organizationName, uf: group.uf, event: group.event.eventType!, confidence: group.confidence, sources: group.evidence.length, eligible: group.eligible })),
    rejectedPreview: rejected.slice(0, 20).map((event) => ({ title: event.result.title, domain: event.result.domain, event: event.eventType, reason: event.rejectionReason ?? "irrelevant" })),
    rejectionReasons,
    errors,
    outcome: "completed",
  };
  if (dryRun) return summary;
  for (const event of extracted) {
      const contentHash = sha256(`${event.result.title}\n${event.result.snippet ?? ""}`);
      const { error } = await client.from("web_discoveries").upsert({
        provider: event.result.provider, query: String(event.result.metadata.query ?? "aggregated"), title: event.result.title, url: event.result.url,
        domain: event.result.domain, snippet: event.result.snippet?.slice(0, 600) ?? null, published_at: event.result.publishedAt,
        retrieved_at: event.result.retrievedAt, content_hash: contentHash,
        status: acceptedUrls.has(event.result.url) ? "ACCEPTED" : "REJECTED", rejection_reason: event.rejectionReason,
        metadata: { eventType: event.eventType, sourceTier: event.sourceTier },
      }, { onConflict: "provider,url,content_hash" });
      if (error) throw error;
    }
  const groups = [...analysis.existing];
  for (const candidate of eligiblePotential) {
    const ensured = await ensureNewContest(client, candidate);
    if (ensured.created) summary.contestsCreated += 1;
    groups.push({ fingerprint: candidate.fingerprint, contest: ensured.contest, event: candidate.event, evidence: candidate.evidence, confidence: candidate.confidence });
  }
  for (const group of groups) {
    const persisted = await persistGroup(client, group);
    summary.movementsCreated += persisted.created;
    summary.movementsUpdated += persisted.updated;
    summary.contestsUpdated += persisted.contestUpdated;
    summary.evidenceLinked += persisted.evidenceLinked;
    summary.sourcesAdded += persisted.sourcesAdded;
    summary.notificationsCreated += persisted.notifications;
  }
  return summary;
}

function skippedSummary(state: "disabled" | "already_running"): PredictedCollectionSummary {
  return {
    dryRun: false, queriesAttempted: 0, queryErrors: 0, confirmationQueriesAttempted: 0, officialConfirmationsFound: 0,
    found: 0, unique: 0, accepted: 0, relevant: 0, rejected: 0, matchedExistingContests: 0,
    potentialNewContests: 0, eligibleNewContests: 0, duplicates: 0, contestsCreated: 0, movementsCreated: 0,
    movementsUpdated: 0, contestsUpdated: 0, evidenceLinked: 0, sourcesAdded: 0, notificationsCreated: 0,
    collectionId: null, preview: [], potentialNewPreview: [], rejectedPreview: [], rejectionReasons: {}, errors: [], outcome: state,
  };
}

export async function runPredictedCollection(options: PredictedCollectionOptions = {}): Promise<PredictedCollectionSummary> {
  if (options.dryRun) return executePredictedCollection(options);
  const client = options.client ?? adminClient();
  const start = await beginCollectorRun(client, "web_discovery", "web_discovery_exa", {
    apiKeyConfigured: Boolean(process.env.EXA_API_KEY),
  });
  if (start.state !== "acquired") return skippedSummary(start.state);
  try {
    const summary = await executePredictedCollection({ ...options, client });
    summary.collectionId = start.lease.runId;
    await heartbeatCollectorRun(client, start.lease);
    await finishCollectorRun(client, start.lease, {
      status: summary.errors.length ? "PARTIAL" : "SUCCESS",
      found: summary.unique,
      created: summary.movementsCreated + summary.contestsCreated,
      updated: summary.movementsUpdated + summary.contestsUpdated,
      unchanged: summary.duplicates,
      rejected: summary.rejected,
      errorCount: summary.errors.length,
      error: summary.errors.length ? new Error(summary.errors.join(" | ")) : undefined,
      metadata: {
        queriesAttempted: summary.queriesAttempted,
        matchedExistingContests: summary.matchedExistingContests,
        evidenceLinked: summary.evidenceLinked,
        sourcesAdded: summary.sourcesAdded,
        notificationsCreated: summary.notificationsCreated,
      },
    });
    return summary;
  } catch (error) {
    await finishCollectorRun(client, start.lease, { status: "FAILED", error });
    operationalLog("error", "collector.unhandled_error", { collector: start.lease.collector, runId: start.lease.runId, ...errorContext(error) });
    throw error;
  }
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(name);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runPredictedCollection({ dryRun: hasFlag("--dry-run") })
    .then((summary) => console.info(JSON.stringify(summary, null, 2)))
    .catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
