export interface ExplicitCutoffScore {
  modality: string;
  score: number;
  classification: number | null;
  evidence: string;
}

function modalityFrom(line: string) {
  if (/\b(?:pcd|pessoa(?:s)? com defici[eê]ncia)\b/i.test(line)) return "PCD";
  if (/\b(?:negros?|pretos?|pardos?|cotas? raciais?)\b/i.test(line)) return "COTAS_RACIAIS";
  if (/\b(?:ind[ií]genas?)\b/i.test(line)) return "INDIGENAS";
  if (/\b(?:ampla concorr[eê]ncia|lista geral)\b/i.test(line)) return "AMPLA_CONCORRENCIA";
  return "GERAL";
}

function decimalScore(value: string) {
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1_000 ? parsed : null;
}

export function extractExplicitCutoffScores(text: string | null): ExplicitCutoffScore[] {
  if (!text) return [];
  const results: ExplicitCutoffScore[] = [];
  const seen = new Set<string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!/\bnota\s+(?:m[ií]nima\s+)?(?:de\s+)?corte\b/i.test(line)) continue;
    const scoreMatch = line.match(/\bnota\s+(?:m[ií]nima\s+)?(?:de\s+)?corte\b[^\d]{0,50}(\d{1,4}(?:[.,]\d{1,4})?)/i);
    if (!scoreMatch) continue;
    const score = decimalScore(scoreMatch[1]);
    if (score === null) continue;
    const classificationMatch = line.match(/\b(\d{1,6})\s*(?:º|ª|o|a)?\s*(?:classificad[oa]|coloca[cç][aã]o|posi[cç][aã]o)\b/i);
    const modality = modalityFrom(line);
    const classification = classificationMatch ? Number(classificationMatch[1]) : null;
    const key = `${modality}|${score}|${classification ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ modality, score, classification, evidence: line.slice(0, 500) });
  }
  return results;
}
