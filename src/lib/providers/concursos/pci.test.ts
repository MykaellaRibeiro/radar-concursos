import { describe, expect, it } from "vitest";
import { parsePciPayload } from "./pci";

describe("contrato MCP PCI", () => {
  it("recusa conteúdo que não é JSON", () => {
    expect(() => parsePciPayload({ content: [{ type: "text", text: "indisponível" }] })).toThrow(/JSON válido/);
  });

  it("recusa JSON sem a coleção data", () => {
    expect(() => parsePciPayload({ content: [{ type: "text", text: "{}" }] })).toThrow(/lista data/);
  });

  it("aceita a estrutura mínima publicada pelo servidor", () => {
    expect(parsePciPayload({ content: [{ type: "text", text: '{"meta":{"total":0},"data":[]}' }] }).data).toEqual([]);
  });
});
