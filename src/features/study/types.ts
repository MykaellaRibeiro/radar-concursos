import type { StudyPriority } from "./domain/study-priority";

export interface PersonalSummary {
  attempts: number;
  answeredQuestions: number;
  correct: number;
  incorrect: number;
  annulled: number;
  accuracy: number | null;
  averageSeconds: number | null;
  lastActivity: string | null;
}

export interface DimensionPerformance {
  id: string;
  slug: string;
  label: string;
  available: number;
  answered: number;
  validAnswered: number;
  correct: number;
  accuracy: number | null;
  coverage: number;
  lastActivity: string | null;
}

export interface ContestTarget {
  id: string;
  contestId: string;
  slug: string;
  title: string;
  status: string;
  confidence: string;
  state: string | null;
  primary: boolean;
  priority: number;
  boardSlug: string | null;
  boardName: string | null;
}

export interface RecentAttempt {
  id: string;
  questionId: string;
  questionNumber: number;
  statement: string;
  correct: boolean;
  annulled: boolean;
  answeredAt: string;
  discipline: string | null;
}

export interface PersonalStudyOverview {
  authenticated: boolean;
  history: PersonalSummary;
  current: PersonalSummary;
  today: PersonalSummary;
  last7Days: PersonalSummary;
  availableQuestions: number;
  coverage: number;
  savedCount: number;
  currentErrors: number;
  disciplines: DimensionPerformance[];
  subjects: DimensionPerformance[];
  boards: DimensionPerformance[];
  targets: ContestTarget[];
  recent: RecentAttempt[];
  priorities: StudyPriority[];
  priorityScope: "CONTEST" | "BOARD" | "GLOBAL";
  priorityScopeLabel: string;
}

