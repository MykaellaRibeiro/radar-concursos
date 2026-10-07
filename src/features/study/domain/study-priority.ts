export const SAMPLE_CONFIDENCE_THRESHOLDS = {
  medium: 5,
  high: 15,
} as const;

export type SampleConfidence = "LOW_SAMPLE" | "MEDIUM_SAMPLE" | "HIGH_SAMPLE";
export type PriorityLabel = "HIGH" | "MEDIUM" | "LOW" | "NOT_ENOUGH_DATA";

export interface PriorityInput {
  id: string;
  label: string;
  historicalCount: number;
  historicalPercentage: number;
  answeredCount: number;
  correctCount: number;
  lastAnsweredAt: string | null;
  targetRelevance: "CONTEST" | "BOARD" | "GLOBAL";
}

export interface StudyPriority {
  id: string;
  label: string;
  priority: PriorityLabel;
  score: number | null;
  sampleConfidence: SampleConfidence;
  accuracy: number | null;
  reasons: string[];
}

export function getSampleConfidence(sampleSize: number): SampleConfidence {
  if (sampleSize >= SAMPLE_CONFIDENCE_THRESHOLDS.high) return "HIGH_SAMPLE";
  if (sampleSize >= SAMPLE_CONFIDENCE_THRESHOLDS.medium) return "MEDIUM_SAMPLE";
  return "LOW_SAMPLE";
}

function recencyScore(lastAnsweredAt: string | null, now: Date) {
  if (!lastAnsweredAt) return 0;
  const days = Math.max(0, (now.getTime() - Date.parse(lastAnsweredAt)) / 86_400_000);
  return days <= 30 ? 1 : days <= 90 ? 0.7 : 0.4;
}

const relevanceScore = { CONTEST: 1, BOARD: 0.75, GLOBAL: 0.5 } as const;

export function calculateStudyPriority(input: PriorityInput, now = new Date()): StudyPriority {
  const sampleConfidence = getSampleConfidence(input.answeredCount);
  const accuracy = input.answeredCount ? input.correctCount / input.answeredCount : null;
  const baseReasons = [
    `${input.historicalCount} questões na amostra (${input.historicalPercentage.toFixed(1).replace(".", ",")}%)`,
    `${input.answeredCount} questões respondidas`,
  ];

  if (sampleConfidence === "LOW_SAMPLE" || accuracy === null) {
    return {
      id: input.id,
      label: input.label,
      priority: "NOT_ENOUGH_DATA",
      score: null,
      sampleConfidence,
      accuracy,
      reasons: [...baseReasons, "Responda ao menos 5 questões deste recorte para calcular a prioridade."],
    };
  }

  const frequency = Math.min(1, Math.max(0, input.historicalPercentage / 25));
  const weakness = 1 - accuracy;
  const recency = recencyScore(input.lastAnsweredAt, now);
  const sampleWeight = sampleConfidence === "HIGH_SAMPLE" ? 1 : 0.78;
  const score = Math.round(100 * sampleWeight * (
    0.42 * frequency
    + 0.40 * weakness
    + 0.10 * relevanceScore[input.targetRelevance]
    + 0.08 * recency
  ));
  const priority: PriorityLabel = score >= 60 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";
  const targetReason = input.targetRelevance === "CONTEST"
    ? "O recorte usa o concurso-alvo."
    : input.targetRelevance === "BOARD"
      ? "O recorte usa o histórico disponível da banca-alvo."
      : "O recorte usa a base global disponível.";

  return {
    id: input.id,
    label: input.label,
    priority,
    score,
    sampleConfidence,
    accuracy,
    reasons: [
      ...baseReasons,
      `${(accuracy * 100).toFixed(1).replace(".", ",")}% de domínio atual`,
      targetReason,
    ],
  };
}

