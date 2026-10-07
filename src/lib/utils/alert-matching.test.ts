import { describe, expect, it } from "vitest";
import { matchesAlert } from "./alert-matching";

describe("matching de alertas", () => {
  it("combina todos os critérios informados", () => expect(matchesAlert({ uf: "PE", area: "TI", escolaridade: "Superior", salarioMin: 4000 }, { uf: "PE", area: "ti", escolaridade: "superior", salarioMax: 6000 })).toBe(true));
  it("rejeita salário abaixo do mínimo", () => expect(matchesAlert({ salarioMin: 5000 }, { salarioMax: 4200 })).toBe(false));
});
