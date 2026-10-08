import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type { SearchOptions, SearchProvider, SearchProviderHealth, SearchResult } from "./types";

const DEFAULT_ENDPOINT = "https://mcp.exa.ai/mcp";
const DEFAULT_TIMEOUT_MS = 45_000;
const RATE_LIMIT_PATTERN = /rate limit|too many requests|quota/i;

type McpTextContent = { type: "text"; text: string };

function textFromContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((item): item is McpTextContent => Boolean(item && typeof item === "object" && (item as McpTextContent).type === "text"))
    .map((item) => item.text)
    .join("\n");
}

function parseResultBlock(block: string, retrievedAt: string): SearchResult | null {
  const title = block.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
  const url = block.match(/^URL:\s*(\S+)$/m)?.[1]?.trim();
  if (!title || !url) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  const published = block.match(/^Published:\s*(.+)$/m)?.[1]?.trim();
  const body = block.match(/^(?:Highlights|Text):\s*([\s\S]*)$/m)?.[1]?.trim() || null;
  const snippet = body ? body.replace(/\s+/g, " ").slice(0, 600) : null;
  const publishedAt = published && !/^unknown|n\/a$/i.test(published) && !Number.isNaN(Date.parse(published))
    ? new Date(published).toISOString()
    : null;

  return {
    title,
    url: parsedUrl.toString(),
    snippet,
    publishedAt,
    domain: parsedUrl.hostname.replace(/^www\./, "").toLowerCase(),
    content: body,
    provider: "exa",
    retrievedAt,
    metadata: {},
  };
}

export function parseExaSearchResponse(text: string, retrievedAt = new Date().toISOString()): SearchResult[] {
  if (RATE_LIMIT_PATTERN.test(text)) throw new Error(`Exa indisponível: ${text.replace(/\s+/g, " ").slice(0, 220)}`);
  return text.split(/\n\s*---\s*\n/g).map((block) => parseResultBlock(block, retrievedAt)).filter((item): item is SearchResult => item !== null);
}

export class ExaSearchProvider implements SearchProvider {
  readonly name = "exa";
  private readonly endpoint: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(options: { endpoint?: string; apiKey?: string; timeoutMs?: number } = {}) {
    this.endpoint = options.endpoint?.trim() || process.env.EXA_MCP_URL?.trim() || DEFAULT_ENDPOINT;
    this.apiKey = options.apiKey?.trim() || process.env.EXA_API_KEY?.trim() || undefined;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async withClient<T>(callback: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({ name: "radar-concursos", version: "0.3.0" });
    const transport = new StreamableHTTPClientTransport(new URL(this.endpoint), {
      requestInit: this.apiKey ? { headers: { "x-api-key": this.apiKey } } : undefined,
    });
    try {
      await client.connect(transport, { timeout: this.timeoutMs });
      return await callback(client);
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const objective = options.objective ?? "Encontrar movimentações concretas e verificáveis de concursos públicos brasileiros, priorizando atos oficiais e páginas com órgão, evento e data identificáveis.";
    const domainContext = options.domains?.length ? ` Priorize apenas estes domínios: ${options.domains.join(", ")}.` : "";
    const result = await this.withClient((client) => client.callTool({
      name: "web_search_exa",
      arguments: {
        query: options.domains?.length ? `${query} (${options.domains.map((domain) => `site:${domain}`).join(" OR ")})` : query,
        objective: `${objective}${domainContext}`,
        numResults: Math.min(Math.max(options.limit ?? 5, 1), 10),
      },
    }, { timeout: this.timeoutMs }));
    const text = textFromContent(result.content);
    const parsed = parseExaSearchResponse(text);
    if (options.domains?.length) {
      const domains = new Set(options.domains.map((domain) => domain.replace(/^www\./, "").toLowerCase()));
      return parsed.filter((item) => [...domains].some((domain) => item.domain === domain || item.domain.endsWith(`.${domain}`)));
    }
    return parsed;
  }

  async searchRecent(query: string, days: number, options: SearchOptions = {}): Promise<SearchResult[]> {
    const safeDays = Math.min(Math.max(days, 1), 30);
    const threshold = Date.now() - safeDays * 86_400_000;
    const results = await this.search(`${query} publicado nos últimos ${safeDays} dias`, {
      ...options,
      objective: `${options.objective ?? "Localizar novidades verificáveis de concursos públicos brasileiros."} Considere apenas conteúdo publicado nos últimos ${safeDays} dias.`,
    });
    return results.filter((result) => !result.publishedAt || Date.parse(result.publishedAt) >= threshold);
  }

  searchDomains(query: string, domains: string[], options: SearchOptions = {}) {
    return this.search(query, { ...options, domains });
  }

  async getContents(urls: string[]): Promise<Map<string, string>> {
    if (!urls.length) return new Map();
    const result = await this.withClient((client) => client.callTool({
      name: "web_fetch_exa",
      arguments: { urls: urls.slice(0, 10), maxCharacters: 12_000 },
    }, { timeout: this.timeoutMs }));
    const text = textFromContent(result.content);
    if (RATE_LIMIT_PATTERN.test(text)) throw new Error(`Exa indisponível: ${text.replace(/\s+/g, " ").slice(0, 220)}`);
    const map = new Map<string, string>();
    for (const url of urls) {
      const start = text.indexOf(url);
      if (start >= 0) map.set(url, text.slice(start, start + 12_000));
    }
    return map;
  }

  async healthCheck(): Promise<SearchProviderHealth> {
    const startedAt = Date.now();
    try {
      const tools = await this.withClient(async (client) => (await client.listTools(undefined, { timeout: this.timeoutMs })).tools.map((tool) => tool.name));
      const required = ["web_search_exa", "web_fetch_exa"];
      const missing = required.filter((tool) => !tools.includes(tool));
      return { ok: missing.length === 0, latencyMs: Date.now() - startedAt, tools, message: missing.length ? `Ferramentas ausentes: ${missing.join(", ")}` : "Exa MCP conectado." };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - startedAt, tools: [], message: error instanceof Error ? error.message : String(error) };
    }
  }
}
