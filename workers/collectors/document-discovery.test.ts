import { describe, expect, it } from "vitest";
import type { SearchResult } from "../../src/lib/providers/search/types";
import { resultToDocumentCandidate, type CatalogContest } from "./document-discovery";

const contest: CatalogContest = {
  id: "contest-1",
  slug: "banco-do-brasil-2023",
  title: "Banco do Brasil — Escriturário 2023",
  state: null,
  organization: "Banco do Brasil",
  organizationAcronym: "BB",
  officialUrl: "https://www.bb.com.br/site/concurso-bb/",
  board: "Fundação Cesgranrio",
  boardAcronym: "CESGRANRIO",
  boardSlug: "cesgranrio",
  boardSite: "https://www.cesgranrio.org.br/",
  year: 2023,
  proofCount: 0,
};

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    title: "Prova objetiva Banco do Brasil 2023",
    url: "https://concursos.cesgranrio.org.br/bb-2023/prova-a.pdf",
    snippet: "Caderno de prova do concurso do Banco do Brasil.",
    publishedAt: "2023-04-23T00:00:00.000Z",
    domain: "concursos.cesgranrio.org.br",
    content: null,
    provider: "exa",
    retrievedAt: "2026-10-08T12:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

describe("document discovery", () => {
  it("aceita prova PDF da banca quando o órgão está identificado", () => {
    const candidate = resultToDocumentCandidate(result(), contest);
    expect(candidate).toMatchObject({ kind: "PROVA", contestSlug: contest.slug });
    expect(candidate?.source.type).toBe("EXAM_BOARD");
  });

  it("aceita documento no domínio oficial do banco", () => {
    const candidate = resultToDocumentCandidate(result({
      title: "Edital de abertura do concurso 2023",
      url: "https://www.bb.com.br/docs/edital-concurso-2023.pdf",
      domain: "bb.com.br",
      snippet: null,
    }), contest);
    expect(candidate).toMatchObject({ kind: "EDITAL", source: { type: "OFFICIAL" } });
  });

  it("rejeita página que não é um PDF direto", () => {
    expect(resultToDocumentCandidate(result({ url: "https://concursos.cesgranrio.org.br/bb-2023/provas", domain: "concursos.cesgranrio.org.br" }), contest)).toBeNull();
  });

  it("rejeita documento de outro concurso", () => {
    expect(resultToDocumentCandidate(result({
      title: "Prova objetiva Petrobras 2023",
      snippet: "Caderno de prova do concurso da Petrobras.",
      url: "https://concursos.cesgranrio.org.br/petrobras/prova.pdf",
    }), contest)).toBeNull();
  });

  it("rejeita fontes especializadas como origem documental", () => {
    expect(resultToDocumentCandidate(result({
      url: "https://pciconcursos.com.br/documentos/banco-do-brasil-prova.pdf",
      domain: "pciconcursos.com.br",
    }), contest)).toBeNull();
  });
});
