import { describe, expect, it } from "vitest";
import { calculateCoverage, calculatePerformanceMetrics, latestValidAttempts } from "./metrics";

const attempts = [
  { questionId: "q1", correct: false, annulled: false, answeredAt: "2026-10-01T10:00:00Z" },
  { questionId: "q1", correct: true, annulled: false, answeredAt: "2026-10-02T10:00:00Z" },
  { questionId: "q2", correct: true, annulled: false, answeredAt: "2026-10-03T10:00:00Z" },
  { questionId: "q3", correct: false, annulled: true, answeredAt: "2026-10-04T10:00:00Z" },
];

describe("personal performance metrics", () => {
  it("excludes annulled attempts from the accuracy denominator", () => {
    const metrics = calculatePerformanceMetrics(attempts);
    expect(metrics.attempts).toBe(4);
    expect(metrics.annulled).toBe(1);
    expect(metrics.correct).toBe(2);
    expect(metrics.incorrect).toBe(1);
    expect(metrics.accuracy).toBeCloseTo(2 / 3);
  });

  it("keeps history while current mastery uses the latest valid attempt", () => {
    const current = latestValidAttempts(attempts);
    expect(current).toHaveLength(2);
    expect(current.find((item) => item.questionId === "q1")?.correct).toBe(true);
  });

  it("counts annulled questions as covered", () => {
    expect(calculateCoverage(attempts.map((item) => item.questionId), ["q1", "q2", "q3", "q4"]))
      .toEqual({ answered: 3, available: 4, percentage: 0.75 });
  });
});
