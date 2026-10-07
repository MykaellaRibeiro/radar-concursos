import { createHash } from "node:crypto";
import type { NormalizedContest, NormalizedRegion } from "./types";
import { regionFromUf } from "../../utils/geography";

export { regionFromUf } from "../../utils/geography";

export interface RawPciItem {
  id?: string | number;
  titulo?: string;
  cargos_resumo?: string;
  cargos?: unknown;
  vagas_salario?: string;
  formacao?: string;
  regiao?: string;
  uf?: string;
  cidade?: string;
  datas?: { inicio?: string; fim?: string; texto?: string; aberto?: boolean; dias_restantes?: number };
  noticia?: { id?: string | number; titulo?: string; link?: string; imagem?: string };
  apostila?: unknown;
  url?: string;
  orgao?: string;
  estado?: string;
  [key: string]: unknown;
}

const states: Record<string, string> = {
  AC: "AC", ACRE: "AC", AL: "AL", ALAGOAS: "AL", AP: "AP", AMAPA: "AP", AM: "AM", AMAZONAS: "AM",
  BA: "BA", BAHIA: "BA", CE: "CE", CEARA: "CE", DF: "DF", "DISTRITO FEDERAL": "DF", ES: "ES",
  "ESPIRITO SANTO": "ES", GO: "GO", GOIAS: "GO", MA: "MA", MARANHAO: "MA", MT: "MT", "MATO GROSSO": "MT",
  MS: "MS", "MATO GROSSO DO SUL": "MS", MG: "MG", "MINAS GERAIS": "MG", PA: "PA", PARA: "PA", PB: "PB",
  PARAIBA: "PB", PR: "PR", PARANA: "PR", PE: "PE", PERNAMBUCO: "PE", PI: "PI", PIAUI: "PI", RJ: "RJ",
  "RIO DE JANEIRO": "RJ", RN: "RN", "RIO GRANDE DO NORTE": "RN", RS: "RS", "RIO GRANDE DO SUL": "RS",
  RO: "RO", RONDONIA: "RO", RR: "RR", RORAIMA: "RR", SC: "SC", "SANTA CATARINA": "SC", SP: "SP",
  "SAO PAULO": "SP", SE: "SE", SERGIPE: "SE", TO: "TO", TOCANTINS: "TO",
};

export function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function comparisonText(value: string): string {
  return collapseWhitespace(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export function normalizeUf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return states[comparisonText(value).toUpperCase()] ?? null;
}

export function normalizeRegion(value: unknown, uf: string | null): NormalizedRegion | null {
  const inferred = regionFromUf(uf);
  if (inferred) return inferred;
  if (typeof value !== "string") return null;
  const key = comparisonText(value).replace(/[ -]+/g, "_").toUpperCase();
  return ["NORTE", "NORDESTE", "CENTRO_OESTE", "SUDESTE", "SUL", "NACIONAL"].includes(key) ? key as NormalizedRegion : null;
}

export function normalizeText(value: unknown): string | null {
  return typeof value === "string" && collapseWhitespace(value) ? collapseWhitespace(value) : null;
}

export function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseBrazilianNumber(value: string): number | null {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeSalary(value: unknown): { min: number | null; max: number | null } {
  if (typeof value !== "string") return { min: null, max: null };
  const matches = [...value.matchAll(/R\$\s*([\d.]+(?:,\d{1,2})?)/gi)]
    .map((match) => parseBrazilianNumber(match[1]))
    .filter((item): item is number => item !== null);
  if (!matches.length) return { min: null, max: null };
  if (matches.length > 1) return { min: Math.min(...matches), max: Math.max(...matches) };
  if (/a partir de|desde|minim/iu.test(value)) return { min: matches[0], max: null };
  return { min: null, max: matches[0] };
}

export function normalizeVacancies(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value !== "string" || (/cadastro\s+reserva|\bCR\b/iu.test(value) && !/\d+\s+vagas?/iu.test(value))) return null;
  const match = value.match(/([\d.]+)\s+vagas?/iu);
  if (!match) return null;
  const parsed = Number(match[1].replace(/\./g, ""));
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const br = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const parts = iso ? [iso[1], iso[2], iso[3]] : br ? [br[3], br[2], br[1]] : null;
  if (!parts) return null;
  const normalized = `${parts[0]}-${parts[1]}-${parts[2]}`;
  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== normalized ? null : normalized;
}

function organizationAcronym(title: string): string | null {
  const candidate = title.split(/\s+-\s+/, 1)[0];
  return /^[A-Z0-9]{2,12}$/.test(candidate) ? candidate : null;
}

function normalizeRoles(value: unknown, fallback: unknown): string[] {
  const source = Array.isArray(value) ? value : typeof fallback === "string" ? fallback.split(",") : [];
  return [...new Set(source.flatMap((item) => typeof item === "string" ? [collapseWhitespace(item)] : []).filter(Boolean))];
}

export function createDeduplicationKey(input: Pick<NormalizedContest, "organization" | "state" | "title" | "roles" | "source" | "registrationStart" | "registrationEnd">): string {
  const parts = [input.organization, input.state ?? "", input.title, [...input.roles].sort().join("|"), input.source.sourceUrl, input.registrationStart ?? "", input.registrationEnd ?? ""];
  return createHash("sha256").update(parts.map(comparisonText).join("::")).digest("hex");
}

export function transformPciItem(item: RawPciItem, collectedAt = new Date().toISOString()): NormalizedContest {
  const title = normalizeText(item.titulo);
  const organization = normalizeText(item.orgao) ?? title;
  const sourceUrl = normalizeUrl(item.noticia?.link ?? item.url);
  if (!title || !organization || !sourceUrl) throw new Error("Item PCI sem título, órgão ou URL válidos.");
  const externalId = String(item.id ?? item.noticia?.id ?? "").trim();
  if (!externalId) throw new Error("Item PCI sem identificador externo.");
  const state = normalizeUf(item.uf ?? item.estado);
  const salary = normalizeSalary(item.vagas_salario);
  const roles = normalizeRoles(item.cargos, item.cargos_resumo);
  const base: Omit<NormalizedContest, "deduplicationKey"> = {
    externalId,
    title,
    organization,
    organizationAcronym: organizationAcronym(title),
    city: normalizeText(item.cidade),
    state,
    region: normalizeRegion(item.regiao, state),
    roles,
    education: normalizeText(item.formacao),
    vacancies: normalizeVacancies(item.vagas_salario),
    salaryMin: salary.min,
    salaryMax: salary.max,
    registrationStart: normalizeDate(item.datas?.inicio),
    registrationEnd: normalizeDate(item.datas?.fim),
    status: item.datas?.aberto === true ? "INSCRICOES_ABERTAS" : null,
    source: { provider: "pci_mcp", sourceName: "PCI Concursos", sourceType: "SPECIALIZED", sourceUrl, collectedAt },
    rawMetadata: { ...item },
  };
  return { ...base, deduplicationKey: createDeduplicationKey(base) };
}

export function deduplicateContests(items: NormalizedContest[]): NormalizedContest[] {
  const providerIds = new Set<string>();
  const dedupKeys = new Set<string>();
  return items.filter((item) => {
    const providerId = `${item.source.provider}:${item.externalId}`;
    if (providerIds.has(providerId) || dedupKeys.has(item.deduplicationKey)) return false;
    providerIds.add(providerId);
    dedupKeys.add(item.deduplicationKey);
    return true;
  });
}
