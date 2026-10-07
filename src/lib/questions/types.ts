import type { ConfidenceLevel } from "@/types/domain";

export const classificationStatuses = [
  "UNCLASSIFIED",
  "AUTO_CLASSIFIED",
  "REVIEW_REQUIRED",
  "REVIEWED",
  "CONFIRMED",
] as const;

export type ClassificationStatus = (typeof classificationStatuses)[number];
export type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "DISCURSIVE" | "OTHER";
export type AlternativeLetter = "A" | "B" | "C" | "D" | "E";

export interface ExamPage {
  pageNumber: number;
  text: string;
}

export interface ParsedQuestion {
  number: number;
  pageNumber: number;
  type: QuestionType;
  statement: string;
  alternatives: Record<AlternativeLetter, string | null>;
  rawText: string;
  parseQuality: number;
  needsReview: boolean;
  warnings: string[];
  contentHash: string;
}

export interface ParsedAnswer {
  number: number;
  answer: AlternativeLetter | null;
  annulled: boolean;
}

export interface DisciplineRange {
  start: number;
  end: number;
  discipline: TaxonomyNodeSeed;
}

export interface TaxonomyNodeSeed {
  name: string;
  slug: string;
  description?: string;
}

export interface SubjectSeed extends TaxonomyNodeSeed {
  disciplineSlug: string;
}

export interface SubsubjectSeed extends TaxonomyNodeSeed {
  subjectSlug: string;
}

export interface QuestionClassification {
  discipline: TaxonomyNodeSeed;
  disciplineStatus: ClassificationStatus;
  disciplineConfidence: ConfidenceLevel;
  subject: SubjectSeed | null;
  subjectStatus: ClassificationStatus;
  subjectConfidence: ConfidenceLevel;
  subsubject: SubsubjectSeed | null;
  subsubjectStatus: ClassificationStatus;
  subsubjectConfidence: ConfidenceLevel;
  overallStatus: ClassificationStatus;
  overallConfidence: ConfidenceLevel;
  reason: string;
}

export interface QuestionStatisticsItem {
  key: string;
  label: string;
  count: number;
  percentage: number;
}

export interface QuestionStatistics {
  sampleSize: number;
  minimumSampleSize: number;
  isSmallSample: boolean;
  items: QuestionStatisticsItem[];
}
