export interface AttemptMetricInput {
  questionId: string;
  correct: boolean;
  annulled: boolean;
  answeredAt: string;
  durationSeconds?: number | null;
}

export interface PerformanceMetrics {
  attempts: number;
  answeredQuestions: number;
  correct: number;
  incorrect: number;
  annulled: number;
  accuracy: number | null;
  averageSeconds: number | null;
  lastActivity: string | null;
}

export function calculatePerformanceMetrics(attempts: AttemptMetricInput[]): PerformanceMetrics {
  const valid = attempts.filter((attempt) => !attempt.annulled);
  const correct = valid.filter((attempt) => attempt.correct).length;
  const durations = attempts.flatMap((attempt) => attempt.durationSeconds == null ? [] : [attempt.durationSeconds]);
  return {
    attempts: attempts.length,
    answeredQuestions: new Set(attempts.map((attempt) => attempt.questionId)).size,
    correct,
    incorrect: valid.length - correct,
    annulled: attempts.length - valid.length,
    accuracy: valid.length ? correct / valid.length : null,
    averageSeconds: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
    lastActivity: attempts.length
      ? [...attempts].sort((left, right) => right.answeredAt.localeCompare(left.answeredAt))[0].answeredAt
      : null,
  };
}

export function latestValidAttempts(attempts: AttemptMetricInput[]) {
  const latest = new Map<string, AttemptMetricInput>();
  for (const attempt of attempts) {
    if (attempt.annulled) continue;
    const current = latest.get(attempt.questionId);
    if (!current || attempt.answeredAt > current.answeredAt) latest.set(attempt.questionId, attempt);
  }
  return [...latest.values()];
}

export function calculateCoverage(answeredQuestionIds: Iterable<string>, availableQuestionIds: Iterable<string>) {
  const available = new Set(availableQuestionIds);
  const answered = new Set([...answeredQuestionIds].filter((id) => available.has(id)));
  return {
    answered: answered.size,
    available: available.size,
    percentage: available.size ? answered.size / available.size : 0,
  };
}

