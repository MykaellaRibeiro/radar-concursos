import { describe, expect, it } from "vitest";
import { buildEventFingerprint } from "./fingerprint";

describe("event fingerprint", () => {
  it("é estável para diferenças de acentuação e caixa", () => {
    const base = { uf: "CE", eventType: "COMISSAO_FORMADA" as const, eventDate: "2026-10-05" };
    expect(buildEventFingerprint({ ...base, orgao: "Secretaria da Educação" })).toBe(buildEventFingerprint({ ...base, orgao: "secretaria educacao" }));
  });

  it("agrupa confirmações publicadas na mesma janela temporal", () => {
    const base = { orgao: "Secretaria de Fazenda", uf: "CE", eventType: "BANCA_DEFINIDA" as const };
    expect(buildEventFingerprint({ ...base, eventDate: "2026-10-05" })).toBe(buildEventFingerprint({ ...base, eventDate: "2026-10-06" }));
  });

  it("usa a identidade estável do órgão sem depender de detalhes opcionais da fonte", () => {
    const base = { uf: "BA", eventType: "BANCA_CONTRATADA" as const, eventDate: "2026-10-05" };
    expect(buildEventFingerprint({ ...base, orgao: "Codeba" })).toBe(buildEventFingerprint({ ...base, orgao: "CODEBA" }));
  });
});
