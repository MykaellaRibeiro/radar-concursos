import { describe, expect, it } from "vitest";
import { parseSerperResponse } from "./serper";

describe("parseSerperResponse", () => {
  it("normaliza resultados orgânicos do Serper", () => {
    const results = parseSerperResponse({
      organic: [{
        title: "Prova objetiva Banco do Brasil 2023",
        link: "https://concursos.cesgranrio.org.br/bb/prova.pdf",
        snippet: "Caderno de prova do concurso.",
        date: "Apr 23, 2023",
        position: 1,
      }],
    }, "2026-10-08T12:00:00.000Z");

    expect(results).toMatchObject([{
      provider: "serper",
      domain: "concursos.cesgranrio.org.br",
      publishedAt: "2023-04-23T00:00:00.000Z",
      metadata: { position: 1 },
    }]);
  });

  it("descarta links inválidos e datas relativas não verificáveis", () => {
    const results = parseSerperResponse({
      organic: [
        { title: "Documento", link: "javascript:alert(1)" },
        { title: "Resultado", link: "https://example.gov.br/resultado.pdf", date: "2 days ago" },
      ],
    });

    expect(results).toHaveLength(1);
    expect(results[0].publishedAt).toBeNull();
  });
});
