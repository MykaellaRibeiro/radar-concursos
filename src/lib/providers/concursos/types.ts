import type { ConcursoStatus } from "@/types/domain";

export type NormalizedRegion = "NORTE" | "NORDESTE" | "CENTRO_OESTE" | "SUDESTE" | "SUL" | "NACIONAL";

export interface ProviderSource {
  provider: string;
  sourceName: string;
  sourceType: "SPECIALIZED";
  sourceUrl: string;
  collectedAt: string;
  contentHash?: string;
}

export interface NormalizedContest {
  externalId: string;
  title: string;
  organization: string;
  organizationAcronym: string | null;
  city: string | null;
  state: string | null;
  region: NormalizedRegion | null;
  roles: string[];
  education: string | null;
  vacancies: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  registrationStart: string | null;
  registrationEnd: string | null;
  status: ConcursoStatus | null;
  source: ProviderSource;
  rawMetadata: Record<string, unknown>;
  deduplicationKey: string;
}

export type ProviderCompetition = NormalizedContest;

export interface ConcursoSearchInput {
  query?: string;
  role?: string;
  city?: string;
  state?: string;
  region?: NormalizedRegion;
  page?: number;
  limit?: number;
}

export interface ProviderHealth {
  ok: boolean;
  tools: string[];
  latencyMs: number;
  error?: string;
}

export interface ConcursosProvider {
  readonly name: string;
  list(input?: ConcursoSearchInput): Promise<NormalizedContest[]>;
  listOpen(input?: ConcursoSearchInput): Promise<NormalizedContest[]>;
  search(input: ConcursoSearchInput): Promise<NormalizedContest[]>;
  searchByRole(role: string, state?: string): Promise<NormalizedContest[]>;
  searchByCity(city: string, state: string): Promise<NormalizedContest[]>;
  healthCheck(): Promise<ProviderHealth>;
}
