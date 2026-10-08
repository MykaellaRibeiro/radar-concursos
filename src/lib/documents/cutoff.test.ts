import { describe, expect, it } from "vitest";
import { extractExplicitCutoffScores } from "./cutoff";

describe("explicit cutoff extraction", () => {
  it("extrai apenas valor explicitamente identificado como nota de corte", () => {
    const result = extractExplicitCutoffScores("Ampla concorrência — nota de corte: 78,50 — 120º classificado");
    expect(result).toEqual([{ modality: "AMPLA_CONCORRENCIA", score: 78.5, classification: 120, evidence: "Ampla concorrência — nota de corte: 78,50 — 120º classificado" }]);
  });

  it("separa modalidades", () => {
    const result = extractExplicitCutoffScores("PCD | nota mínima de corte = 62.25");
    expect(result[0]).toMatchObject({ modality: "PCD", score: 62.25 });
  });

  it("não transforma notas comuns nem anos em corte", () => {
    expect(extractExplicitCutoffScores("Resultado final 2024. Candidato: nota 91,5.")).toEqual([]);
    expect(extractExplicitCutoffScores("Nota de corte: 2024")).toEqual([]);
  });
});
