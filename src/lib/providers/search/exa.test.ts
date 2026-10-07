import { describe, expect, it } from "vitest";
import { parseExaSearchResponse } from "./exa";

describe("parseExaSearchResponse", () => {
  it("normaliza blocos do Exa", () => {
    const result = parseExaSearchResponse("Title: Concurso autorizado\nURL: https://example.gov.br/noticia\nPublished: 2026-10-04\nAuthor: Governo\nText: Governo autoriza concurso.", "2026-10-05T12:00:00.000Z");
    expect(result).toMatchObject([{ title: "Concurso autorizado", domain: "example.gov.br", publishedAt: "2026-10-04T00:00:00.000Z" }]);
  });

  it("trata limite do MCP como falha", () => {
    expect(() => parseExaSearchResponse("You've hit Exa's free MCP rate limit.")).toThrow(/rate limit/i);
  });
});
