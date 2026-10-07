import { describe, expect, it } from "vitest";
import { inferOrganizationLabel, matchExistingContest, matchOrganization } from "./contest-matcher";
import type { OrganizationCandidate } from "./extractor";

const organizations: OrganizationCandidate[] = [
  { id: "cro-rj", name: "Conselho Regional de Odontologia do Rio de Janeiro", acronym: "CRO", uf: "RJ", city: "Rio de Janeiro", aliases: ["CRO RJ"] },
  { id: "cro-se", name: "Conselho Regional de Odontologia de Sergipe", acronym: "CRO", uf: "SE", city: "Aracaju", aliases: ["CRO SE"] },
];

describe("contest matcher", () => {
  it("usa UF para desambiguar siglas iguais", () => {
    expect(matchOrganization("Concurso CRO RJ: banca contratada", "RJ", organizations)?.organization.id).toBe("cro-rj");
  });

  it("não associa sigla curta ambígua sem localização", () => {
    expect(matchOrganization("Concurso CRO terá edital", null, organizations)).toBeNull();
  });

  it("prioriza concurso previsto do mesmo órgão", () => {
    const match = matchExistingContest({ organizationId: "cro-rj", uf: "RJ", text: "CRO RJ banca definida" }, [
      { id: "old", orgao_id: "cro-rj", titulo: "CRO RJ 2024", status: "ENCERRADO", uf: "RJ", cidade: null },
      { id: "next", orgao_id: "cro-rj", titulo: "CRO RJ", status: "PREVISTO", uf: "RJ", cidade: null },
    ]);
    expect(match?.contest.id).toBe("next");
  });

  it("infere rótulo de candidato novo sem inventar nome legal", () => {
    expect(inferOrganizationLabel("Concurso Codeba BA: contrato assinado", "BA")).toEqual({ name: "Codeba", acronym: null });
    expect(inferOrganizationLabel("Concurso Codeba tem banca contratada | Folha Dirigida", null)).toEqual({ name: "Codeba", acronym: null });
  });
});
