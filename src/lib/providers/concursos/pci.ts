import { Client, StreamableHTTPClientTransport, type CallToolResult } from "@modelcontextprotocol/client";
import { deduplicateContests, normalizeUf, transformPciItem, type RawPciItem } from "./pci-transform";
import type { ConcursoSearchInput, ConcursosProvider, NormalizedContest, ProviderHealth } from "./types";

const expectedTools = ["listar_concursos", "pesquisar_concursos", "buscar_por_cargo", "buscar_por_cidade"];
const DEFAULT_PCI_ENDPOINT = "https://mcp.pciconcursos.com.br/mcp";

interface PciPayload {
  meta?: { total?: number; timestamp?: number; data_atual?: string; filtros?: Record<string, unknown> };
  data: RawPciItem[];
}

export interface PciProviderOptions {
  endpoint?: string;
  timeoutMs?: number;
  retries?: number;
}

export interface PciCallStats {
  received: number;
  normalized: number;
  discarded: number;
  unique: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function resolvePciEndpoint(explicit?: string): string {
  return explicit?.trim() || process.env.PCI_MCP_URL?.trim() || DEFAULT_PCI_ENDPOINT;
}

export function parsePciPayload(result: CallToolResult): PciPayload {
  if (result.isError) throw new Error("O servidor PCI retornou erro para a ferramenta MCP.");
  const text = result.content?.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("Payload PCI sem conteúdo textual.");
  let payload: unknown;
  try {
    payload = JSON.parse(text.text);
  } catch {
    throw new Error("Payload PCI não contém JSON válido.");
  }
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as PciPayload).data)) {
    throw new Error("Payload PCI não possui a lista data esperada.");
  }
  return payload as PciPayload;
}

export class PciConcursosProvider implements ConcursosProvider {
  readonly name = "pci_mcp";
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private stats: PciCallStats = { received: 0, normalized: 0, discarded: 0, unique: 0 };

  constructor(options: PciProviderOptions | string = {}) {
    const normalized = typeof options === "string" ? { endpoint: options } : options;
    this.endpoint = resolvePciEndpoint(normalized.endpoint);
    this.timeoutMs = normalized.timeoutMs ?? 45_000;
    this.retries = Math.max(0, Math.min(normalized.retries ?? 2, 3));
  }

  private async withClient<T>(run: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({ name: "radar-concursos", version: "0.2.0" });
    const transport = new StreamableHTTPClientTransport(new URL(this.endpoint));
    try {
      await client.connect(transport, { timeout: this.timeoutMs });
      return await run(client);
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  private async withRetry<T>(label: string, run: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        return await run();
      } catch (error) {
        lastError = error;
        if (attempt === this.retries) break;
        await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
      }
    }
    throw new Error(`[PCI] ${label} falhou após ${this.retries + 1} tentativa(s): ${errorMessage(lastError)}`);
  }

  private async call(name: string, args: Record<string, unknown>): Promise<NormalizedContest[]> {
    const payload = await this.withRetry(name, () => this.withClient(async (client) => {
      const tools = await client.listTools(undefined, { timeout: this.timeoutMs });
      if (!tools.tools.some((tool) => tool.name === name)) throw new Error(`Ferramenta MCP indisponível: ${name}`);
      const result = await client.callTool({ name, arguments: args }, { timeout: this.timeoutMs });
      return parsePciPayload(result);
    }));
    const collectedAt = new Date().toISOString();
    const normalized: NormalizedContest[] = [];
    for (const item of payload.data) {
      try {
        normalized.push(transformPciItem(item, collectedAt));
      } catch {
        // Invalid external items are counted by the collector from received - normalized.
      }
    }
    const unique = deduplicateContests(normalized);
    this.stats = { received: payload.data.length, normalized: normalized.length, discarded: payload.data.length - normalized.length, unique: unique.length };
    return unique;
  }

  get lastCallStats(): Readonly<PciCallStats> {
    return this.stats;
  }

  async list(input: ConcursoSearchInput = {}): Promise<NormalizedContest[]> {
    const args: Record<string, unknown> = {};
    if (input.region && input.region !== "NACIONAL") args.regiao = input.region.toLowerCase().replace("_", "-");
    const items = await this.call("listar_concursos", args);
    return input.limit ? items.slice(0, input.limit) : items;
  }

  async listOpen(input: ConcursoSearchInput = {}): Promise<NormalizedContest[]> {
    const items = await this.list({ ...input, limit: undefined });
    const open = items.filter((item) => item.status === "INSCRICOES_ABERTAS");
    this.stats = { ...this.stats, discarded: this.stats.discarded + (items.length - open.length), unique: open.length };
    return input.limit ? open.slice(0, input.limit) : open;
  }

  async search(input: ConcursoSearchInput): Promise<NormalizedContest[]> {
    if (input.role) return this.searchByRole(input.role, input.state);
    if (input.city) {
      if (!input.state) throw new Error("A busca por cidade no PCI exige a UF.");
      return this.searchByCity(input.city, input.state);
    }
    if (!input.query?.trim()) return this.listOpen(input);
    const uf = input.state ? normalizeUf(input.state) : null;
    const items = await this.call("pesquisar_concursos", { termo: input.query.trim(), ...(uf ? { uf: uf.toLowerCase() } : {}) });
    return input.limit ? items.slice(0, input.limit) : items;
  }

  async searchByRole(role: string, state?: string): Promise<NormalizedContest[]> {
    if (!role.trim()) throw new Error("Informe o cargo para pesquisar no PCI.");
    const uf = state ? normalizeUf(state) : null;
    return this.call("buscar_por_cargo", { cargo: role.trim(), ...(uf ? { uf: uf.toLowerCase() } : {}) });
  }

  async searchByCity(city: string, state: string): Promise<NormalizedContest[]> {
    const uf = normalizeUf(state);
    if (!city.trim() || !uf) throw new Error("Informe cidade e UF válidas para pesquisar no PCI.");
    return this.call("buscar_por_cidade", { cidade: city.trim(), uf: uf.toLowerCase() });
  }

  async healthCheck(): Promise<ProviderHealth> {
    const started = Date.now();
    try {
      const tools = await this.withRetry("healthCheck", () => this.withClient(async (client) => {
        const result = await client.listTools(undefined, { timeout: this.timeoutMs });
        return result.tools.map((tool) => tool.name);
      }));
      return { ok: expectedTools.every((tool) => tools.includes(tool)), tools, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, tools: [], latencyMs: Date.now() - started, error: errorMessage(error) };
    }
  }
}

export const pciExpectedTools = expectedTools;
