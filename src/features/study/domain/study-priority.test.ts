import { describe, expect, it } from "vitest";
import { calculateStudyPriority, getSampleConfidence } from "./study-priority";

describe("study priority", () => {
  it("centralizes sample confidence thresholds", () => {
    expect(getSampleConfidence(1)).toBe("LOW_SAMPLE");
    expect(getSampleConfidence(4)).toBe("LOW_SAMPLE");
    expect(getSampleConfidence(5)).toBe("MEDIUM_SAMPLE");
    expect(getSampleConfidence(14)).toBe("MEDIUM_SAMPLE");
    expect(getSampleConfidence(15)).toBe("HIGH_SAMPLE");
  });

  it("does not recommend from insufficient personal evidence", () => {
    expect(calculateStudyPriority({
      id: "constitutional", label: "Direito Constitucional", historicalCount: 18,
      historicalPercentage: 25, answeredCount: 4, correctCount: 0,
      lastAnsweredAt: "2026-10-06T12:00:00Z", targetRelevance: "CONTEST",
    }, new Date("2026-10-07T12:00:00Z")).priority).toBe("NOT_ENOUGH_DATA");
  });

  it("raises high-incidence weak performance and lowers mastered low incidence", () => {
    const high = calculateStudyPriority({
      id: "a", label: "A", historicalCount: 20, historicalPercentage: 25,
      answeredCount: 15, correctCount: 4, lastAnsweredAt: "2026-10-06T12:00:00Z", targetRelevance: "CONTEST",
    }, new Date("2026-10-07T12:00:00Z"));
    const low = calculateStudyPriority({
      id: "b", label: "B", historicalCount: 3, historicalPercentage: 4,
      answeredCount: 15, correctCount: 14, lastAnsweredAt: "2026-10-06T12:00:00Z", targetRelevance: "GLOBAL",
    }, new Date("2026-10-07T12:00:00Z"));
    expect(high.priority).toBe("HIGH");
    expect(low.priority).toBe("LOW");
    expect(high.score).toBeGreaterThan(low.score ?? 0);
  });
});

