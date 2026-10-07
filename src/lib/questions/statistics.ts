import type { ClassificationStatus, QuestionStatistics } from "./types";
import type { ConfidenceLevel } from "@/types/domain";

export const MINIMUM_STATISTICS_SAMPLE = 20;

export interface ClassifiedStatisticRow {
  key: string | null;
  label: string | null;
  status: ClassificationStatus;
  confidence: ConfidenceLevel;
}

export function isStatisticsEligible(status: ClassificationStatus, confidence: ConfidenceLevel): boolean {
  return status === "CONFIRMED"
    || (status === "AUTO_CLASSIFIED" && (confidence === "HIGH" || confidence === "OFFICIAL"));
}

export function buildQuestionStatistics(
  rows: readonly ClassifiedStatisticRow[],
  minimumSampleSize = MINIMUM_STATISTICS_SAMPLE,
): QuestionStatistics {
  const eligible = rows.filter((row) => (
    row.key
    && row.label
    && isStatisticsEligible(row.status, row.confidence)
  ));
  const counts = new Map<string, { label: string; count: number }>();
  for (const row of eligible) {
    const key = row.key as string;
    const current = counts.get(key);
    counts.set(key, { label: row.label as string, count: (current?.count ?? 0) + 1 });
  }
  const sampleSize = eligible.length;
  const items = [...counts.entries()]
    .map(([key, item]) => ({
      key,
      label: item.label,
      count: item.count,
      percentage: sampleSize ? Number((item.count * 100 / sampleSize).toFixed(2)) : 0,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "pt-BR"));

  return {
    sampleSize,
    minimumSampleSize,
    isSmallSample: sampleSize < minimumSampleSize,
    items,
  };
}
