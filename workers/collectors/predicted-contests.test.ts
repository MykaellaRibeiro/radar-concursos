import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SearchProvider } from "../../src/lib/providers/search/types";
import { runPredictedCollection } from "./predicted-contests";

describe("predicted collector dry run", () => {
  it("classifica e associa sem executar escrita", async () => {
    const write = vi.fn();
    const rows: Record<string, unknown[]> = {
      orgaos: [{ id: "org-1", nome: "Secretaria da Fazenda do Ceará", sigla: "SEFAZ", uf: "CE", cidade: "Fortaleza" }],
      orgao_aliases: [{ orgao_id: "org-1", alias: "SEFAZ CE" }],
      concursos: [{ id: "contest-1", orgao_id: "org-1", titulo: "Concurso SEFAZ CE", slug: "sefaz-ce", status: "PREVISTO", confidence: "LOW", uf: "CE", cidade: "Fortaleza", regiao: "NORDESTE", escolaridade_resumo: null, salario_max: null, vagas_previstas: null }],
    };
    const client = {
      from(table: string) {
        return {
          select: vi.fn(async () => ({ data: rows[table] ?? [], error: null })),
          insert: write,
          update: write,
          upsert: write,
        };
      },
    } as unknown as SupabaseClient;
    const provider: SearchProvider = {
      name: "fixture",
      search: vi.fn(),
      searchDomains: vi.fn(),
      getContents: vi.fn(),
      healthCheck: vi.fn(),
      searchRecent: vi.fn(async () => [{
        title: "Concurso SEFAZ CE autorizado",
        url: "https://example.gov.br/concurso-sefaz-ce",
        domain: "example.gov.br",
        publishedAt: "2026-10-06T10:00:00.000Z",
        snippet: "Governo autoriza concurso SEFAZ CE.", content: null, provider: "fixture",
        retrievedAt: "2026-10-06T12:00:00.000Z", metadata: {},
      }]),
    };
    const summary = await runPredictedCollection({ client, provider, dryRun: true, queries: ["concurso autorizado"] });
    expect(summary).toMatchObject({ dryRun: true, accepted: 1, matchedExistingContests: 1, movementsCreated: 0 });
    expect(write).not.toHaveBeenCalled();
  });
});
