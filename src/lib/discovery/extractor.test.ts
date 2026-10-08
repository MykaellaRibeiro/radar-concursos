import { describe, expect, it } from "vitest";
import { extractDiscovery } from "./extractor";

describe("discovery extractor", () => {
  it("preserva o rótulo e captura o nome jurídico apenas quando a fonte o explicita", () => {
    const discovery = extractDiscovery({
      title: "Concurso Codeba BA: assinado contrato com banca",
      url: "https://example.com/codeba",
      snippet: "A Codeba (Companhia Docas do Estado da Bahia) contratou o Instituto AOCP.",
      publishedAt: "2026-10-05T09:00:00.000Z",
      domain: "example.com",
      content: null,
      provider: "fixture",
      retrievedAt: "2026-10-06T12:00:00.000Z",
      metadata: {},
    }, []);

    expect(discovery).toMatchObject({
      orgaoName: "Codeba",
      orgaoLegalName: "Companhia Docas do Estado da Bahia",
      uf: "BA",
      boardName: "Instituto AOCP",
      eventType: "BANCA_CONTRATADA",
    });
  });

  it("não reaproveita vagas de concurso anterior citadas apenas no corpo", () => {
    const discovery = extractDiscovery({
      title: "Concurso Codeba tem banca contratada e edital já pode sair",
      url: "https://example.com/codeba",
      snippet: "O contrato atual confirma empregos de nível médio; vagas a definir.",
      publishedAt: "2026-10-05T09:00:00.000Z",
      domain: "example.com",
      content: "O último concurso, realizado em 2023, ofereceu 26 vagas imediatas.",
      provider: "fixture",
      retrievedAt: "2026-10-06T12:00:00.000Z",
      metadata: {},
    }, []);

    expect(discovery.vacancies).toBeNull();
  });

  it("reconhece a Cesgranrio como banca", () => {
    const discovery = extractDiscovery({
      title: "Concurso Banco do Brasil tem banca definida",
      url: "https://www.bb.com.br/concurso",
      snippet: "A Fundação Cesgranrio foi escolhida para organizar a seleção.",
      publishedAt: "2026-10-08T09:00:00.000Z",
      domain: "bb.com.br",
      content: null,
      provider: "fixture",
      retrievedAt: "2026-10-08T12:00:00.000Z",
      metadata: {},
    }, []);

    expect(discovery.boardName).toBe("Cesgranrio");
  });

  it("identifica o banco por seu domínio oficial", () => {
    const discovery = extractDiscovery({
      title: "BANCO BRB DIVULGA EDITAL PARA NOVO CONCURSO",
      url: "https://novo.brb.com.br/imprensa/edital-concurso",
      snippet: "O edital foi publicado pelo Banco BRB.",
      publishedAt: "2022-07-08T09:00:00.000Z",
      domain: "novo.brb.com.br",
      content: null,
      provider: "fixture",
      retrievedAt: "2026-10-08T12:00:00.000Z",
      metadata: {},
    }, []);

    expect(discovery).toMatchObject({
      orgaoName: "Banco de Brasília",
      orgaoAcronym: "BRB",
      sourceTier: "OFFICIAL",
      rejectionReason: null,
    });
  });
});
