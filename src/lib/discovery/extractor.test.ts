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
});
