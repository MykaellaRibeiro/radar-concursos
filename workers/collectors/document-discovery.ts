import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentCandidate, DocumentKind } from "../../src/lib/documents/types";
import { sourceDisplayName, rankSource } from "../../src/lib/discovery/source-ranking";
import { DocumentSearchProvider, type DocumentDiscoverySubject } from "../../src/lib/providers/documents/search";
import type { SearchProvider, SearchResult } from "../../src/lib/providers/search/types";
import { normalizeEntityName } from "../../src/lib/utils/normalization";

export type CatalogContest = {
  id: string;
  slug: string;
  title: string;
  state: string | null;
  organization: string;
  organizationAcronym: string | null;
  officialUrl: string | null;
  board: string | null;
  boardAcronym: string | null;
  boardSlug: string | null;
  boardSite: string | null;
  year: number | null;
  proofCount: number;
};

export interface DocumentDiscoveryReport {
  candidates: DocumentCandidate[];
  catalogTotal: number;
  catalogOffset: number;
  contestsSearched: number;
  resultsFound: number;
  rejected: number;
  errors: Array<{ key: string; message: string }>;
}

type RawContest = {
  id: string;
  slug: string;
  titulo: string;
  uf: string | null;
  data_edital: string | null;
  data_prova: string | null;
  created_at: string;
  orgao_id: string;
};

type RawOrganization = { id: string; nome: string; sigla: string | null; site_oficial: string | null };
type RawBoard = { id: string; nome: string; sigla: string | null; slug: string; site: string | null };
type RawContestBoard = { concurso_id: string; banca_id: string; is_primary: boolean };
type RawProof = { concurso_id: string };

const DOCUMENT_ORDER: Record<DocumentKind, number> = {
  EDITAL: 0,
  RETIFICACAO: 1,
  PROVA: 2,
  GABARITO: 3,
  RESULTADO: 4,
  CONCORRENCIA: 5,
  COMUNICADO: 6,
  PORTARIA: 7,
  CONTRATO_BANCA: 8,
  OUTRO: 9,
};

const BANKING_PATTERN = /\b(?:banco|caixa|bndes|bnb|brb|banrisul|basa)\b/i;
const GENERIC_ORGANIZATION_WORDS = new Set([
  "companhia", "empresa", "estado", "federal", "fundacao", "instituto", "municipal", "nacional",
  "publico", "publica", "secretaria", "servico", "sociedade",
]);

function yearFrom(...values: Array<string | null | undefined>): number | null {
  for (const value of values) {
    if (!value) continue;
    const match = value.match(/\b(20\d{2}|19\d{2})\b/);
    if (match) return Number(match[1]);
  }
  return null;
}

function domainFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function domainMatches(actual: string, expected: string | null) {
  return Boolean(expected && (actual === expected || actual.endsWith(`.${expected}`)));
}

function significantOrganizationTokens(organization: string) {
  return normalizeEntityName(organization)
    .split(" ")
    .filter((token) => token.length >= 4 && !GENERIC_ORGANIZATION_WORDS.has(token));
}

function resultText(result: SearchResult) {
  return normalizeEntityName([result.title, result.snippet, result.content, result.url].filter(Boolean).join(" "));
}

function matchesOrganization(result: SearchResult, contest: CatalogContest, sourceTier: "OFFICIAL" | "EXAM_BOARD") {
  const haystack = resultText(result);
  const normalizedOrganization = normalizeEntityName(contest.organization);
  const normalizedAcronym = normalizeEntityName(contest.organizationAcronym ?? "");
  const officialDomain = domainFromUrl(contest.officialUrl);

  if (normalizedOrganization.length >= 5 && haystack.includes(normalizedOrganization)) return true;
  if (normalizedAcronym.length >= 3 && haystack.split(" ").includes(normalizedAcronym)) return true;

  const tokens = significantOrganizationTokens(contest.organization);
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  if (tokens.length && matches >= Math.min(2, tokens.length)) return true;

  // An official organization domain is strong identity evidence, but only after
  // the result has also been classified as a concrete document.
  return sourceTier === "OFFICIAL" && domainMatches(result.domain, officialDomain);
}

function classifyDocument(result: SearchResult): { kind: DocumentKind; semanticType: string } | null {
  const text = resultText(result);
  if (/\b(?:gabarito|respostas? definitivas?)\b/.test(text)) {
    return { kind: "GABARITO", semanticType: /preliminar/.test(text) ? "PRELIMINAR" : /retificad/.test(text) ? "RETIFICADO" : "DEFINITIVO" };
  }
  if (/\b(?:resultado final|classificacao final|lista (?:final )?de classificados|nota (?:minima )?(?:de )?corte)\b/.test(text)) {
    return { kind: "RESULTADO", semanticType: /preliminar/.test(text) ? "PRELIMINAR" : "DEFINITIVO" };
  }
  if (/\b(?:concorrencia|demanda de candidatos|candidatos por vaga)\b/.test(text)) return { kind: "CONCORRENCIA", semanticType: "DEMANDA" };
  if (/\b(?:prova|caderno|questoes)\b/.test(text)) return { kind: "PROVA", semanticType: "OBJETIVA" };
  if (/\bretifica(?:cao|dor|do)?\b/.test(text) && /\bedital\b/.test(text)) return { kind: "RETIFICACAO", semanticType: "RETIFICACAO" };
  if (/\bedital\b/.test(text)) return { kind: "EDITAL", semanticType: "ABERTURA" };
  return null;
}

function isPdfResult(result: SearchResult) {
  try {
    return decodeURIComponent(new URL(result.url).pathname).toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

function candidateKey(contestSlug: string, result: SearchResult) {
  return `exa-${contestSlug}-${createHash("sha256").update(result.url).digest("hex").slice(0, 12)}`;
}

export function resultToDocumentCandidate(result: SearchResult, contest: CatalogContest): DocumentCandidate | null {
  const sourceTier = rankSource(result.domain);
  if (sourceTier !== "OFFICIAL" && sourceTier !== "EXAM_BOARD") return null;
  if (!isPdfResult(result)) return null;
  const classification = classifyDocument(result);
  if (!classification || !matchesOrganization(result, contest, sourceTier)) return null;

  const resultYear = yearFrom(result.title, result.snippet, result.url) ?? contest.year;
  const key = candidateKey(contest.slug, result);
  return {
    key,
    contestSlug: contest.slug,
    kind: classification.kind,
    semanticType: classification.semanticType,
    title: result.title.trim().slice(0, 300),
    sourceUrl: result.url,
    discoveryUrl: result.url,
    publishedAt: result.publishedAt,
    source: {
      name: sourceDisplayName(result.domain),
      domain: result.domain,
      type: sourceTier,
      official: true,
      reliabilityScore: sourceTier === "OFFICIAL" ? 1 : 0.9,
    },
    notice: classification.kind === "EDITAL" || classification.kind === "RETIFICACAO"
      ? { number: null, year: resultYear }
      : undefined,
    exam: ["PROVA", "GABARITO", "RESULTADO", "CONCORRENCIA"].includes(classification.kind)
      ? {
          year: resultYear,
          boardName: contest.board,
          boardAcronym: contest.boardAcronym,
          boardSlug: contest.boardSlug,
          boardSite: contest.boardSite,
          role: null,
          shift: null,
          questionCount: null,
        }
      : undefined,
  };
}

function pairAnswerKeys(candidates: DocumentCandidate[]) {
  const accepted: DocumentCandidate[] = [];
  const byContest = new Map<string, DocumentCandidate[]>();
  for (const candidate of candidates) {
    const group = byContest.get(candidate.contestSlug) ?? [];
    group.push(candidate);
    byContest.set(candidate.contestSlug, group);
  }
  for (const contestCandidates of byContest.values()) {
    const proofs = contestCandidates.filter((candidate) => candidate.kind === "PROVA");
    for (const candidate of contestCandidates) {
      if (candidate.kind !== "GABARITO") {
        accepted.push(candidate);
        continue;
      }
      const sameYear = proofs.filter((proof) => proof.exam?.year && proof.exam.year === candidate.exam?.year);
      const related = sameYear.length === 1 ? sameYear[0] : proofs.length === 1 ? proofs[0] : null;
      if (related) accepted.push({ ...candidate, relatedProofKey: related.key });
    }
  }
  return accepted.sort((left, right) => DOCUMENT_ORDER[left.kind] - DOCUMENT_ORDER[right.kind]);
}

async function loadCatalog(client: SupabaseClient): Promise<CatalogContest[]> {
  const [contestsResult, organizationsResult, contestBoardsResult, boardsResult, proofsResult] = await Promise.all([
    client.from("concursos").select("id,slug,titulo,uf,data_edital,data_prova,created_at,orgao_id").limit(1000),
    client.from("orgaos").select("id,nome,sigla,site_oficial").limit(1000),
    client.from("concursos_bancas").select("concurso_id,banca_id,is_primary").limit(2000),
    client.from("bancas").select("id,nome,sigla,slug,site").limit(500),
    client.from("provas").select("concurso_id").limit(5000),
  ]);
  const error = contestsResult.error ?? organizationsResult.error ?? contestBoardsResult.error ?? boardsResult.error ?? proofsResult.error;
  if (error) throw error;

  const organizations = new Map(((organizationsResult.data ?? []) as RawOrganization[]).map((item) => [item.id, item]));
  const boards = new Map(((boardsResult.data ?? []) as RawBoard[]).map((item) => [item.id, item]));
  const contestBoards = new Map<string, RawContestBoard>();
  for (const item of (contestBoardsResult.data ?? []) as RawContestBoard[]) {
    const current = contestBoards.get(item.concurso_id);
    if (!current || item.is_primary) contestBoards.set(item.concurso_id, item);
  }
  const proofCounts = new Map<string, number>();
  for (const proof of (proofsResult.data ?? []) as RawProof[]) proofCounts.set(proof.concurso_id, (proofCounts.get(proof.concurso_id) ?? 0) + 1);

  return ((contestsResult.data ?? []) as RawContest[]).flatMap((contest) => {
    const organization = organizations.get(contest.orgao_id);
    if (!organization) return [];
    const boardRelation = contestBoards.get(contest.id);
    const board = boardRelation ? boards.get(boardRelation.banca_id) : null;
    return [{
      id: contest.id,
      slug: contest.slug,
      title: contest.titulo,
      state: contest.uf,
      organization: organization.nome,
      organizationAcronym: organization.sigla,
      officialUrl: organization.site_oficial,
      board: board?.nome ?? null,
      boardAcronym: board?.sigla ?? null,
      boardSlug: board?.slug ?? null,
      boardSite: board?.site ?? null,
      year: yearFrom(contest.data_prova, contest.data_edital, contest.titulo, contest.created_at),
      proofCount: proofCounts.get(contest.id) ?? 0,
    }];
  });
}

function priority(contest: CatalogContest) {
  const bank = BANKING_PATTERN.test(`${contest.organization} ${contest.organizationAcronym ?? ""} ${contest.title}`) ? 0 : 1;
  return [bank, contest.organization, contest.title, contest.slug] as const;
}

function compareContests(left: CatalogContest, right: CatalogContest) {
  const leftPriority = priority(left);
  const rightPriority = priority(right);
  for (let index = 0; index < leftPriority.length; index += 1) {
    const comparison = String(leftPriority[index]).localeCompare(String(rightPriority[index]), "pt-BR", { numeric: true });
    if (comparison) return comparison;
  }
  return 0;
}

export function selectCatalogBatch(catalog: CatalogContest[], offset: number, maxContests: number) {
  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0;
  const safeLimit = Number.isFinite(maxContests) ? Math.max(1, Math.trunc(maxContests)) : 1;
  return [...catalog].sort(compareContests).slice(safeOffset, safeOffset + safeLimit);
}

export function rotatingCatalogOffset(catalogTotal: number, maxContests: number, cycle: number) {
  if (catalogTotal <= 0) return 0;
  const safeLimit = Number.isFinite(maxContests) ? Math.max(1, Math.trunc(maxContests)) : 1;
  const batches = Math.ceil(catalogTotal / safeLimit);
  const safeCycle = Number.isFinite(cycle) ? Math.max(0, Math.trunc(cycle)) : 0;
  return (safeCycle % batches) * safeLimit;
}

export async function discoverCatalogDocuments(input: {
  client: SupabaseClient;
  searchProvider: SearchProvider;
  maxContests: number;
  maxFilesPerContest: number;
  contestOffset?: number;
  rotateCatalog?: boolean;
  rotationCycle?: number;
}): Promise<DocumentDiscoveryReport> {
  const fullCatalog = await loadCatalog(input.client);
  const weeklyCycle = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const catalogOffset = input.rotateCatalog
    ? rotatingCatalogOffset(fullCatalog.length, input.maxContests, input.rotationCycle ?? weeklyCycle)
    : Number.isFinite(input.contestOffset)
      ? Math.max(0, Math.trunc(input.contestOffset ?? 0))
      : 0;
  const catalog = selectCatalogBatch(fullCatalog, catalogOffset, input.maxContests);
  const provider = new DocumentSearchProvider(input.searchProvider);
  const candidates: DocumentCandidate[] = [];
  const errors: Array<{ key: string; message: string }> = [];
  let resultsFound = 0;
  let rejected = 0;

  for (const contest of catalog) {
    const subject: DocumentDiscoverySubject = {
      organization: contest.organization,
      state: contest.state,
      board: contest.board,
      role: null,
      year: contest.year,
    };
    try {
      const results = await provider.discover(subject);
      resultsFound += results.length;
      const seen = new Set<string>();
      let acceptedForContest = 0;
      for (const result of results) {
        if (seen.has(result.url)) continue;
        seen.add(result.url);
        const candidate = resultToDocumentCandidate(result, contest);
        if (!candidate || acceptedForContest >= input.maxFilesPerContest) {
          rejected += 1;
          continue;
        }
        candidates.push(candidate);
        acceptedForContest += 1;
      }
    } catch (error) {
      errors.push({ key: contest.slug, message: error instanceof Error ? error.message : String(error) });
    }
  }

  const paired = pairAnswerKeys(candidates);
  rejected += candidates.length - paired.length;
  return {
    candidates: paired,
    catalogTotal: fullCatalog.length,
    catalogOffset,
    contestsSearched: catalog.length,
    resultsFound,
    rejected,
    errors,
  };
}
