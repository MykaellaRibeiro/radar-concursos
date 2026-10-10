import { describe, expect, it, vi } from "vitest";
import type { SearchProvider } from "../search/types";
import { DocumentSearchProvider } from "./search";

describe("DocumentSearchProvider", () => {
  it("cobre os documentos do concurso com quatro consultas", async () => {
    const search = vi.fn().mockResolvedValue([]);
    const provider: SearchProvider = {
      name: "test",
      search,
      searchRecent: vi.fn().mockResolvedValue([]),
      searchDomains: vi.fn().mockResolvedValue([]),
      getContents: vi.fn().mockResolvedValue(new Map()),
      healthCheck: vi.fn().mockResolvedValue({ ok: true, latencyMs: 0, tools: [], message: "ok" }),
    };

    await new DocumentSearchProvider(provider).discover({
      organization: "Banco do Brasil",
      state: null,
      board: "Cesgranrio",
      role: null,
      year: 2023,
    });

    expect(search).toHaveBeenCalledTimes(4);
    expect(search.mock.calls.map(([query]) => query)).toEqual(expect.arrayContaining([
      expect.stringMatching(/edital/),
      expect.stringMatching(/gabarito/),
      expect.stringMatching(/resultado final/),
      expect.stringMatching(/candidatos por vaga/),
    ]));
    expect(search.mock.calls.every(([, options]) => options.limit === 10)).toBe(true);
  });
});
