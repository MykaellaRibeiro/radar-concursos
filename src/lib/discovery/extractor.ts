import { classifyEvent, eventToStatus } from "./event-classifier";
import { confidenceForEvidence, rankSource } from "./source-ranking";
import type { ExtractedDiscovery } from "./types";
import type { SearchResult } from "@/lib/providers/search/types";
import { inferOrganizationLabel, matchOrganization } from "./contest-matcher";

export interface OrganizationCandidate {
  id: string;
  name: string;
  acronym: string | null;
  uf: string | null;
  city: string | null;
  aliases: string[];
}

export interface InformationExtractor {
  extract(result: SearchResult, organizations: OrganizationCandidate[]): ExtractedDiscovery;
}

const BOARD_PATTERNS: Array<[string, RegExp]> = [
  ["Cebraspe", /\b(?:cebraspe|cespe)\b/i], ["FGV", /\bfgv\b|funda[cç][aã]o getulio vargas/i],
  ["FCC", /\bfcc\b|funda[cç][aã]o carlos chagas/i], ["Vunesp", /\bvunesp\b/i],
  ["Instituto AOCP", /\baocp\b/i], ["IBFC", /\bibfc\b/i],
];

function extractVacancies(text: string): number | null {
  const match = text.match(/(?:autoriza(?:das?|[cç][aã]o de)?|oferta(?:r[aá])?|com)?\s*([\d.]{1,9})\s+vagas?\b/i);
  if (!match) return null;
  const value = Number(match[1].replace(/\./g, ""));
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function explicitUf(text: string): string | null {
  const match = text.match(/(?:\b|\/)(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function extractLegalOrganizationName(text: string, label: string | null): string | null {
  if (!label) return null;
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`\\b${escaped}\\b[^()\\n]{0,50}\\(([^)\\n]{8,140})\\)`, "i"));
  const candidate = match?.[1]?.replace(/\s+/g, " ").trim() ?? null;
  if (!candidate || /^(?:banca|edital|concurso|processo|estado|munic[ií]pio)\b/i.test(candidate)) return null;
  return candidate;
}

export function extractDiscovery(result: SearchResult, organizations: OrganizationCandidate[]): ExtractedDiscovery {
  const summaryText = `${result.title}\n${result.snippet ?? ""}`;
  const text = `${summaryText}\n${result.content ?? ""}`.slice(0, 20_000);
  const eventType = classifyEvent(result.title) ?? classifyEvent(text);
  const uf = explicitUf(`${result.title}\n${result.snippet ?? ""}`);
  const organizationMatch = matchOrganization(text, uf, organizations);
  const organization = organizationMatch?.organization ?? null;
  const inferred = organization ? null : inferOrganizationLabel(result.title, uf);
  const legalName = organization ? null : extractLegalOrganizationName(text, inferred?.name ?? null);
  const sourceTier = rankSource(result.domain);
  const boardName = BOARD_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
  const eventDate = (result.publishedAt ?? result.retrievedAt).slice(0, 10);
  let rejectionReason: ExtractedDiscovery["rejectionReason"] = null;
  if (!eventType) rejectionReason = "unsupported_event";
  else if (!organization && !inferred) rejectionReason = "missing_contest_context";

  return {
    result,
    eventType,
    status: eventType ? eventToStatus(eventType) : null,
    sourceTier,
    confidence: confidenceForEvidence([sourceTier]),
    orgaoId: organization?.id ?? null,
    orgaoName: organization?.name ?? inferred?.name ?? null,
    orgaoLegalName: legalName,
    orgaoAcronym: organization?.acronym ?? inferred?.acronym ?? null,
    organizationMatchScore: organizationMatch?.score ?? 0,
    matchedExistingOrganization: Boolean(organization),
    uf: organization?.uf ?? uf,
    city: organization?.city ?? null,
    // Full articles frequently cite vacancy counts from previous exams. Only
    // accept this high-impact field from the current result's title/snippet.
    vacancies: extractVacancies(summaryText),
    boardName,
    eventDate,
    rejectionReason,
  };
}

export class RuleBasedInformationExtractor implements InformationExtractor {
  extract(result: SearchResult, organizations: OrganizationCandidate[]) {
    return extractDiscovery(result, organizations);
  }
}
