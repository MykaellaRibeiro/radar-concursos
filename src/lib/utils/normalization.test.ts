import { describe, expect, it } from "vitest";
import { buildDeduplicationKey, normalizeEntityName } from "./normalization";

describe("normalização", () => {
  it("remove acentos, conectores e pontuação", () => expect(normalizeEntityName("Polícia Civil do Maranhão")).toBe("policia civil maranhao"));
  it("produz uma chave determinística", () => expect(buildDeduplicationKey({ orgao: "PC-MA", uf: "MA", titulo: "Concurso PC MA", ano: 2026 })).toBe("pc ma:ma:concurso pc ma:2026"));
});
