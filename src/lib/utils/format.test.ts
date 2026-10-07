import { describe, expect, it } from "vitest";
import { competitionRatio } from "./format";

describe("concorrência", () => {
  it("calcula candidatos por vaga", () => expect(competitionRatio(1250, 50)).toBe(25));
  it("não divide por zero", () => expect(competitionRatio(100, 0)).toBeNull());
});
