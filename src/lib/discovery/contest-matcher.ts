import { normalizeEntityName } from "@/lib/utils/normalization";
import type { ConcursoStatus } from "@/types/domain";
import type { OrganizationCandidate } from "./extractor";

export interface ContestCandidate {
  id: string;
  orgao_id: string;
  titulo: string;
  status: ConcursoStatus;
  uf: string | null;
  cidade: string | null;
}

export interface OrganizationMatch {
  organization: OrganizationCandidate;
  score: number;
}

const PREDICTED_STATUSES = new Set<ConcursoStatus>([
  "SOLICITADO", "ANUNCIADO", "PREVISTO", "AUTORIZADO", "COMISSAO_FORMADA", "BANCA_EM_DEFINICAO",
  "BANCA_DEFINIDA", "BANCA_CONTRATADA", "EDITAL_EM_ELABORACAO", "EDITAL_IMINENTE",
]);

function containsPhrase(haystack: string, needle: string) {
  return needle.length >= 3 && ` ${haystack} `.includes(` ${needle} `);
}

export function matchOrganization(text: string, explicitUf: string | null, organizations: OrganizationCandidate[]): OrganizationMatch | null {
  const normalizedText = normalizeEntityName(text);
  const matches = organizations.flatMap((organization) => {
    if (explicitUf && organization.uf && explicitUf !== organization.uf) return [];
    let score = -1;
    const canonical = normalizeEntityName(organization.name);
    if (containsPhrase(normalizedText, canonical)) score = Math.max(score, 100 + canonical.length);
    for (const alias of organization.aliases) {
      const normalized = normalizeEntityName(alias);
      if (containsPhrase(normalizedText, normalized)) score = Math.max(score, 70 + normalized.length);
    }
    if (organization.acronym) {
      const acronym = normalizeEntityName(organization.acronym);
      if (containsPhrase(normalizedText, acronym)) {
        const locationEvidence = explicitUf && organization.uf === explicitUf;
        score = Math.max(score, (locationEvidence ? 85 : acronym.length >= 5 ? 55 : 20) + acronym.length);
      }
    }
    if (score < 0) return [];
    if (organization.city && containsPhrase(normalizedText, normalizeEntityName(organization.city))) score += 12;
    return [{ organization, score }];
  }).sort((a, b) => b.score - a.score);
  if (!matches.length) return null;
  if (matches[1] && matches[0].score === matches[1].score) return null;
  if (matches[0].score < 50) return null;
  return matches[0];
}

export function matchExistingContest(input: { organizationId: string; uf: string | null; text: string }, contests: ContestCandidate[]): { contest: ContestCandidate; score: number } | null {
  const text = normalizeEntityName(input.text);
  const candidates = contests.flatMap((contest) => {
    if (contest.orgao_id !== input.organizationId) return [];
    if (input.uf && contest.uf && input.uf !== contest.uf) return [];
    const normalizedTitle = normalizeEntityName(contest.titulo);
    let score = PREDICTED_STATUSES.has(contest.status) ? 35 : 0;
    if (containsPhrase(text, normalizedTitle)) score += 80 + normalizedTitle.length;
    if (contest.cidade && containsPhrase(text, normalizeEntityName(contest.cidade))) score += 10;
    if (input.uf && contest.uf === input.uf) score += 15;
    return [{ contest, score }];
  }).sort((a, b) => b.score - a.score);
  if (!candidates.length) return null;
  if (candidates[1] && candidates[0].score === candidates[1].score) return null;
  return candidates[0];
}

export function inferOrganizationLabel(title: string, uf: string | null): { name: string; acronym: string | null } | null {
  const withoutPrefix = title.replace(/^\s*(?:novo\s+)?concurso\s+/i, "").trim();
  if (withoutPrefix === title.trim()) return null;
  const ufSuffix = uf ? new RegExp(`\\s+(?:${uf})\\b[\\s\\S]*$`, "i") : /:\s*[\s\S]*$/;
  const raw = withoutPrefix
    .replace(ufSuffix, "")
    .split(/\s(?:[:—–|-]|tem\b|avan[cç]a\b|define\b|contrata\b|autoriza\b|anuncia\b)/i)[0]
    .trim();
  if (raw.length < 3 || raw.length > 120 || /^(p[uú]blico|previsto|autorizado|edital)/i.test(raw)) return null;
  return { name: raw, acronym: /^[A-ZÀ-Ý0-9]{2,12}$/u.test(raw) ? raw.toUpperCase() : null };
}
