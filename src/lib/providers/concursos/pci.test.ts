import { describe, expect, it } from "vitest";
import { parsePciPayload, resolvePciEndpoint } from "./pci";

describe("contrato MCP PCI", () => {
  it("usa o endpoint oficial quando a configuração está vazia", () => {
    const previous = process.env.PCI_MCP_URL;
    process.env.PCI_MCP_URL = "   ";
    try {
      expect(resolvePciEndpoint()).toBe("https://mcp.pciconcursos.com.br/mcp");
      expect(resolvePciEndpoint("")).toBe("https://mcp.pciconcursos.com.br/mcp");
    } finally {
      if (previous === undefined) delete process.env.PCI_MCP_URL;
      else process.env.PCI_MCP_URL = previous;
    }
  });

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
