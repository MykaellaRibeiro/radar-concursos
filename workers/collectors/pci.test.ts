import { describe, expect, it } from "vitest";
import { resolvePciSanityLimit, resolvePciSupplementalQueryLimit } from "./pci";

describe("configuração do coletor PCI", () => {
  it("usa os padrões quando o GitHub fornece variáveis vazias", () => {
    expect(resolvePciSanityLimit("")).toBe(2500);
    expect(resolvePciSanityLimit("   ")).toBe(2500);
    expect(resolvePciSupplementalQueryLimit("")).toBe(8);
  });

  it("mantém os limites configurados dentro da faixa segura", () => {
    expect(resolvePciSanityLimit("40")).toBe(100);
    expect(resolvePciSanityLimit("20000")).toBe(10_000);
    expect(resolvePciSupplementalQueryLimit("3")).toBe(3);
    expect(resolvePciSupplementalQueryLimit("20")).toBe(8);
  });
});
