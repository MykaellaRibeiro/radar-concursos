import type { ConfidenceLevel } from "@/types/domain";
import type { SourceTier } from "./types";

const OFFICIAL_SUFFIXES = [
  "gov.br", "jus.br", "leg.br", "mp.br", "def.br", "bb.com.br", "caixa.gov.br", "bndes.gov.br",
  "bnb.gov.br", "bancoamazonia.com.br", "brb.com.br", "banrisul.com.br",
];
const BOARDS = ["cebraspe.org.br", "fgv.br", "fcc.org.br", "vunesp.com.br", "institutoaocp.org.br", "ibfc.org.br", "cesgranrio.org.br"];
const SPECIALIZED_HIGH = ["folha.qconcursos.com", "estrategiaconcursos.com.br", "concursos.estrategia.com", "blog.grancursosonline.com.br", "grancursosonline.com.br", "pciconcursos.com.br", "jcconcursos.com.br", "jcconcursos.uol.com.br"];
const SPECIALIZED = ["direcaoconcursos.com.br", "acheconcursos.com.br", "qconcursos.com"];

const SOURCE_NAMES: Record<string, string> = {
  "folha.qconcursos.com": "Folha Dirigida",
  "estrategiaconcursos.com.br": "Estratégia Concursos",
  "concursos.estrategia.com": "Estratégia Concursos",
  "blog.grancursosonline.com.br": "Gran Concursos",
  "grancursosonline.com.br": "Gran Concursos",
  "pciconcursos.com.br": "PCI Concursos",
  "jcconcursos.com.br": "JC Concursos",
  "jcconcursos.uol.com.br": "JC Concursos",
  "direcaoconcursos.com.br": "Direção Concursos",
  "acheconcursos.com.br": "Ache Concursos",
};

function matches(domain: string, candidates: string[]) {
  return candidates.some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`));
}

export function rankSource(domain: string): SourceTier {
  const normalized = domain.replace(/^www\./, "").toLowerCase();
  if (matches(normalized, OFFICIAL_SUFFIXES)) return "OFFICIAL";
  if (matches(normalized, BOARDS)) return "EXAM_BOARD";
  if (matches(normalized, SPECIALIZED_HIGH)) return "SPECIALIZED_HIGH";
  if (matches(normalized, SPECIALIZED)) return "SPECIALIZED";
  if (/noticia|news|jornal|diario/.test(normalized)) return "NEWS";
  return "OTHER";
}

export function sourceDisplayName(domain: string): string {
  const normalized = domain.replace(/^www\./, "").toLowerCase();
  const configured = Object.entries(SOURCE_NAMES).find(([candidate]) => normalized === candidate || normalized.endsWith(`.${candidate}`));
  return configured?.[1] ?? normalized;
}

export function confidenceForEvidence(tiers: SourceTier[]): ConfidenceLevel {
  if (tiers.includes("OFFICIAL")) return "OFFICIAL";
  const independent = new Set(tiers.filter((tier) => tier !== "OTHER"));
  if (tiers.filter((tier) => tier === "EXAM_BOARD" || tier === "SPECIALIZED_HIGH").length >= 2 || independent.size >= 3) return "HIGH";
  if (tiers.some((tier) => ["EXAM_BOARD", "SPECIALIZED_HIGH", "SPECIALIZED"].includes(tier))) return "MEDIUM";
  return "LOW";
}
