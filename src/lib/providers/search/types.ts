export interface SearchResult {
  title: string;
  url: string;
  snippet: string | null;
  publishedAt: string | null;
  domain: string;
  content: string | null;
  provider: string;
  retrievedAt: string;
  metadata: Record<string, unknown>;
}

export interface SearchOptions {
  limit?: number;
  objective?: string;
  domains?: string[];
}

export interface SearchProviderHealth {
  ok: boolean;
  latencyMs: number;
  tools: string[];
  message: string;
}

export interface SearchProvider {
  readonly name: string;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  searchRecent(query: string, days: number, options?: SearchOptions): Promise<SearchResult[]>;
  searchDomains(query: string, domains: string[], options?: SearchOptions): Promise<SearchResult[]>;
  getContents(urls: string[]): Promise<Map<string, string>>;
  healthCheck(): Promise<SearchProviderHealth>;
}
