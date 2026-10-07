import { describe, expect, it } from "vitest";
import { classifyEvent, eventToStatus } from "./event-classifier";

describe("classifyEvent", () => {
  it.each([
    ["Portaria institui comissão organizadora do novo certame", "COMISSAO_FORMADA"],
    ["Banca Cebraspe é contratada para organizar o concurso", "BANCA_CONTRATADA"],
    ["Assinado contrato com banca e edital está iminente", "BANCA_CONTRATADA"],
    ["Governo autoriza concurso com 100 vagas", "CONCURSO_AUTORIZADO"],
    ["Edital está em elaboração", "EDITAL_EM_ELABORACAO"],
    ["Inscrições foram prorrogadas", "INSCRICOES_PRORROGADAS"],
  ])("classifica %s", (text, expected) => expect(classifyEvent(text)).toBe(expected));

  it("não transforma evento meramente informativo em status", () => {
    expect(eventToStatus("RETIFICACAO")).toBeNull();
  });
});
