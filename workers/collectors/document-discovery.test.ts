import { describe, expect, it } from "vitest";
import type { SearchResult } from "../../src/lib/providers/search/types";
import {
  resultToDocumentCandidate,
  rotatingCatalogOffset,
  selectCatalogBatch,
  type CatalogContest,
} from "./document-discovery";

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
  it("seleciona lotes diferentes sem perder a prioridade bancária", () => {
    const caixa = { ...contest, id: "contest-2", slug: "caixa-2024", organization: "Caixa Econômica Federal", title: "Caixa 2024" };
    const tribunal = { ...contest, id: "contest-3", slug: "trt-2024", organization: "Tribunal Regional do Trabalho", title: "TRT 2024" };

    expect(selectCatalogBatch([tribunal, caixa, contest], 0, 2).map((item) => item.slug)).toEqual([
      contest.slug,
      caixa.slug,
    ]);
    expect(selectCatalogBatch([tribunal, caixa, contest], 2, 2).map((item) => item.slug)).toEqual([tribunal.slug]);
  });

  it("rotaciona o lote semanal por todo o catálogo", () => {
    expect(rotatingCatalogOffset(519, 10, 0)).toBe(0);
    expect(rotatingCatalogOffset(519, 10, 51)).toBe(510);
    expect(rotatingCatalogOffset(519, 10, 52)).toBe(0);
  });

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

  it("classifica resultado oficial antes de confundi-lo com prova", () => {
    const candidate = resultToDocumentCandidate(result({
      title: "Resultado final — Banco do Brasil 2023",
      snippet: "Classificação final após a prova objetiva.",
      url: "https://concursos.cesgranrio.org.br/bb-2023/resultado-final.pdf",
    }), contest);
    expect(candidate).toMatchObject({ kind: "RESULTADO", semanticType: "DEFINITIVO" });
  });
});
