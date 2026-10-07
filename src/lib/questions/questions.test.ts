import { describe, expect, it } from "vitest";
import { parseFgvAnswerKey } from "./answer-key-parser";
import { RuleBasedQuestionClassifier } from "./classifier";
import { parseFgvObjectiveExam } from "./parser";
import { pcmaDisciplineForQuestion } from "./pcma-2012";
import { buildQuestionStatistics, isStatisticsEligible, MINIMUM_STATISTICS_SAMPLE } from "./statistics";

const proofPages = [{
  pageNumber: 3,
  text: `CONCURSO PÚBLICO PARA O CARGO DE INVESTIGADOR DE POLÍCIA
PROVA TIPO 1 – BRANCA – 3
Língua Portuguesa
01. Observe a charge a seguir.
Assinale a afirmativa correta.
(A) Primeira alternativa.
(B) Segunda alternativa.
(C) Terceira alternativa.
(D) Quarta alternativa.
(E) Quinta alternativa.
02. Assinale a afirmativa correta.
(A)
(B)
(C)
(D)
(E)
03. Questão propositalmente incompleta.
(A) Uma.
(B) Duas.`,
}];

const answerKey = `GABARITO DEFINITIVO TIPO 01
1 – B
2 – *
3 – E
* = Questão Anulada
GABARITO DEFINITIVO TIPO 02
1 – A
2 – C
3 – D`;

describe("FGV objective parser", () => {
  it("extracts numbered questions, alternatives, page and a stable hash", () => {
    const firstRun = parseFgvObjectiveExam(proofPages, 3);
    const secondRun = parseFgvObjectiveExam(proofPages, 3);
    expect(firstRun).toHaveLength(2);
    expect(firstRun[0]).toMatchObject({
      number: 1,
      pageNumber: 3,
      type: "MULTIPLE_CHOICE",
      statement: expect.stringContaining("Observe a charge"),
      alternatives: { A: "Primeira alternativa.", B: "Segunda alternativa.", C: "Terceira alternativa.", D: "Quarta alternativa.", E: "Quinta alternativa." },
    });
    expect(firstRun[0].contentHash).toBe(secondRun[0].contentHash);
    expect(firstRun[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps a visual question with empty extracted alternatives for review", () => {
    const question = parseFgvObjectiveExam(proofPages, 3)[1];
    expect(question.number).toBe(2);
    expect(question.needsReview).toBe(true);
    expect(question.parseQuality).toBeLessThan(0.85);
    expect(question.alternatives).toEqual({ A: null, B: null, C: null, D: null, E: null });
  });

  it("does not persist a structurally incomplete question", () => {
    expect(parseFgvObjectiveExam(proofPages, 3).map((question) => question.number)).not.toContain(3);
  });
});

describe("FGV answer-key parser", () => {
  it("selects the requested proof type and preserves annulments", () => {
    expect(parseFgvAnswerKey(answerKey, 1, 3)).toEqual([
      { number: 1, answer: "B", annulled: false },
      { number: 2, answer: null, annulled: true },
      { number: 3, answer: "E", annulled: false },
    ]);
  });
});

describe("taxonomy and rule-based classification", () => {
  it("maps official PC-MA ranges without crossing discipline boundaries", () => {
    expect(pcmaDisciplineForQuestion(15)?.slug).toBe("lingua-portuguesa");
    expect(pcmaDisciplineForQuestion(16)?.slug).toBe("legislacao-especifica");
    expect(pcmaDisciplineForQuestion(70)?.slug).toBe("nocoes-de-direito-penal-e-processual-penal");
    expect(pcmaDisciplineForQuestion(71)).toBeNull();
  });

  it("classifies an explicit topic with high confidence and retains official discipline confidence", () => {
    const parsed = parseFgvObjectiveExam([{
      pageNumber: 8,
      text: `38. Como eu insiro uma nota de rodapé no meu documento do Microsoft Word?
(A) A
(B) B
(C) C
(D) D
(E) E`,
    }])[0];
    const discipline = pcmaDisciplineForQuestion(38);
    expect(discipline).not.toBeNull();
    const classification = new RuleBasedQuestionClassifier().classify(parsed, { discipline: discipline! });
    expect(classification.disciplineConfidence).toBe("OFFICIAL");
    expect(classification.subject?.slug).toBe("microsoft-word");
    expect(classification.subsubject?.slug).toBe("notas-de-rodape");
    expect(classification.subjectConfidence).toBe("HIGH");
  });
});

describe("statistics eligibility", () => {
  it("accepts only confirmed or high-confidence automatic classification", () => {
    expect(isStatisticsEligible("CONFIRMED", "MEDIUM")).toBe(true);
    expect(isStatisticsEligible("AUTO_CLASSIFIED", "HIGH")).toBe(true);
    expect(isStatisticsEligible("AUTO_CLASSIFIED", "MEDIUM")).toBe(false);
    expect(isStatisticsEligible("REVIEW_REQUIRED", "OFFICIAL")).toBe(false);
  });

  it("returns sample size, ranking and the centralized small-sample flag", () => {
    const stats = buildQuestionStatistics([
      { key: "portugues", label: "Língua Portuguesa", status: "CONFIRMED", confidence: "OFFICIAL" },
      { key: "portugues", label: "Língua Portuguesa", status: "CONFIRMED", confidence: "OFFICIAL" },
      { key: "informatica", label: "Informática", status: "AUTO_CLASSIFIED", confidence: "HIGH" },
      { key: "incerto", label: "Incerto", status: "REVIEW_REQUIRED", confidence: "LOW" },
    ]);
    expect(stats.sampleSize).toBe(3);
    expect(stats.minimumSampleSize).toBe(MINIMUM_STATISTICS_SAMPLE);
    expect(stats.isSmallSample).toBe(true);
    expect(stats.items[0]).toMatchObject({ key: "portugues", count: 2, percentage: 66.67 });
  });
});
