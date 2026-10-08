import type { SearchOptions, SearchProvider, SearchProviderHealth, SearchResult } from "./types";

const DEFAULT_ENDPOINT = "https://google.serper.dev/search";
const DEFAULT_TIMEOUT_MS = 20_000;

type SerperOrganicResult = {
  title?: unknown;
  link?: unknown;
  snippet?: unknown;
  date?: unknown;
  position?: unknown;
};

type SerperResponse = {
  organic?: unknown;
};

function publishedAt(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || /\b(?:ago|atrás|ontem|hoje)\b/i.test(value)) return null;
  const trimmed = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00.000Z`
    : /(?:Z|GMT|UTC|[+-]\d{2}:?\d{2})$/i.test(trimmed)
      ? trimmed
      : `${trimmed} UTC`;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

export function parseSerperResponse(payload: unknown, retrievedAt = new Date().toISOString()): SearchResult[] {
  if (!payload || typeof payload !== "object") return [];
  const organic = (payload as SerperResponse).organic;
  if (!Array.isArray(organic)) return [];

  return organic.flatMap((raw): SearchResult[] => {
    const item = raw as SerperOrganicResult;
    if (typeof item.title !== "string" || typeof item.link !== "string") return [];
    let url: URL;
    try {
      url = new URL(item.link);
    } catch {
      return [];
    }
    if (!/^https?:$/.test(url.protocol)) return [];

    return [{
      title: item.title.trim(),
      url: url.toString(),
      snippet: typeof item.snippet === "string" ? item.snippet.trim() || null : null,
      publishedAt: publishedAt(item.date),
      domain: url.hostname.replace(/^www\./, "").toLowerCase(),
      content: null,
      provider: "serper",
      retrievedAt,
      metadata: {
        position: typeof item.position === "number" ? item.position : null,
      },
    }];
  });
}

export class SerperSearchProvider implements SearchProvider {
  readonly name = "serper";
  private readonly endpoint: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(options: { endpoint?: string; apiKey?: string; timeoutMs?: number } = {}) {
    this.endpoint = options.endpoint?.trim() || process.env.SERPER_API_URL?.trim() || DEFAULT_ENDPOINT;
    this.apiKey = options.apiKey?.trim() || process.env.SERPER_API_KEY?.trim() || undefined;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.apiKey) throw new Error("Configure SERPER_API_KEY no ambiente do coletor documental.");
    const domainQuery = options.domains?.length
      ? `${query} (${options.domains.map((domain) => `site:${domain}`).join(" OR ")})`
      : query;
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({
        q: domainQuery,
        gl: "br",
        hl: "pt-br",
        num: Math.min(Math.max(options.limit ?? 10, 1), 10),
        autocorrect: true,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 220);
      throw new Error(`Serper indisponível (${response.status}): ${detail || response.statusText}`);
    }
    const parsed = parseSerperResponse(await response.json());
    if (!options.domains?.length) return parsed;
    const domains = new Set(options.domains.map((domain) => domain.replace(/^www\./, "").toLowerCase()));
    return parsed.filter((item) => [...domains].some((domain) => item.domain === domain || item.domain.endsWith(`.${domain}`)));
  }

  async searchRecent(query: string, days: number, options: SearchOptions = {}): Promise<SearchResult[]> {
    const safeDays = Math.min(Math.max(days, 1), 30);
    const after = new Date(Date.now() - safeDays * 86_400_000).toISOString().slice(0, 10);
    const threshold = Date.parse(`${after}T00:00:00.000Z`);
    const results = await this.search(`${query} after:${after}`, options);
    return results.filter((result) => !result.publishedAt || Date.parse(result.publishedAt) >= threshold);
  }

  searchDomains(query: string, domains: string[], options: SearchOptions = {}) {
    return this.search(query, { ...options, domains });
  }

  async getContents() {
    return new Map<string, string>();
  }

  async healthCheck(): Promise<SearchProviderHealth> {
    return {
      ok: Boolean(this.apiKey),
      latencyMs: 0,
      tools: ["google_search"],
      message: this.apiKey ? "Serper configurado." : "SERPER_API_KEY ausente.",
    };
  }
}
