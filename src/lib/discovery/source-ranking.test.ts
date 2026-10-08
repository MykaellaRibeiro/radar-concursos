import { describe, expect, it } from "vitest";
import { confidenceForEvidence, rankSource } from "./source-ranking";

describe("source ranking", () => {
  it("prioriza domínios oficiais", () => expect(rankSource("agencia.ac.gov.br")).toBe("OFFICIAL"));
  it("reconhece domínios oficiais de bancos públicos", () => expect(rankSource("concursos.bb.com.br")).toBe("OFFICIAL"));
  it("reconhece bancas", () => expect(rankSource("cebraspe.org.br")).toBe("EXAM_BOARD"));
  it("reconhece a Cesgranrio e seus subdomínios", () => expect(rankSource("concursos.cesgranrio.org.br")).toBe("EXAM_BOARD"));
  it("reconhece veículos especializados prioritários", () => expect(rankSource("jcconcursos.com.br")).toBe("SPECIALIZED_HIGH"));
  it("promove confiança com fonte oficial", () => expect(confidenceForEvidence(["OTHER", "OFFICIAL"])).toBe("OFFICIAL"));
  it("promove duas fontes fortes independentes", () => expect(confidenceForEvidence(["SPECIALIZED_HIGH", "EXAM_BOARD"])).toBe("HIGH"));
});
