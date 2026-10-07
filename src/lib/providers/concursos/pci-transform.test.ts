import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/pci-listar.json";
import { createDeduplicationKey, deduplicateContests, normalizeDate, normalizeRegion, normalizeSalary, normalizeUf, normalizeVacancies, transformPciItem } from "./pci-transform";

describe("normalização PCI", () => {
  it("transforma um payload real capturado no modelo interno", () => {
    const result = transformPciItem(fixture.data[0], "2026-10-05T00:00:00Z");
    expect(result).toMatchObject({
      externalId: "294690", title: "SEFAZ - Secretaria de Estado da Fazenda de Alagoas", organizationAcronym: "SEFAZ",
      state: "AL", region: "NORDESTE", vacancies: 40, salaryMin: null, salaryMax: 25270.68,
      registrationStart: "2026-09-17", registrationEnd: "2026-10-21", status: "INSCRICOES_ABERTAS",
      source: { provider: "pci_mcp", sourceName: "PCI Concursos", sourceType: "SPECIALIZED" },
    });
    expect(result.rawMetadata).toEqual(fixture.data[0]);
    expect(result.deduplicationKey).toHaveLength(64);
  });

  it("normaliza UFs e infere a região sem depender do payload", () => {
    expect(normalizeUf(" Ceará ")).toBe("CE");
    expect(normalizeUf("sp")).toBe("SP");
    expect(normalizeUf("XX")).toBeNull();
    expect(normalizeRegion(undefined, "DF")).toBe("CENTRO_OESTE");
    expect(normalizeRegion("nacional", null)).toBe("NACIONAL");
  });

  it("converte salários brasileiros sem inventar o limite ausente", () => {
    expect(normalizeSalary("até R$ 10.428,05")).toEqual({ min: null, max: 10428.05 });
    expect(normalizeSalary("de R$ 3.000,00 a R$ 8.500,50")).toEqual({ min: 3000, max: 8500.5 });
    expect(normalizeSalary("não informado")).toEqual({ min: null, max: null });
  });

  it("converte datas válidas e rejeita datas impossíveis", () => {
    expect(normalizeDate("05/10/2026")).toBe("2026-10-05");
    expect(normalizeDate("2026-10-21")).toBe("2026-10-21");
    expect(normalizeDate("31/02/2026")).toBeNull();
  });

  it("converte vagas e mantém cadastro reserva como desconhecido", () => {
    expect(normalizeVacancies("1.250 vagas até R$ 3.000,00")).toBe(1250);
    expect(normalizeVacancies("40 vagas + 60 CR")).toBe(40);
    expect(normalizeVacancies("Cadastro Reserva")).toBeNull();
  });

  it("deduplica por provider/id e pela chave composta", () => {
    const first = transformPciItem(fixture.data[0]);
    const duplicate = { ...first, rawMetadata: { refreshed: true } };
    const second = transformPciItem(fixture.data[1]);
    expect(deduplicateContests([first, duplicate, second])).toHaveLength(2);
    expect(createDeduplicationKey(first)).toBe(first.deduplicationKey);
  });

  it("recusa payload incompleto ou URL insegura", () => {
    expect(() => transformPciItem({ id: 1, titulo: "X", noticia: { link: "javascript:alert(1)" } })).toThrow(/URL/);
    expect(() => transformPciItem({ id: 1, titulo: "X" })).toThrow();
  });
});
