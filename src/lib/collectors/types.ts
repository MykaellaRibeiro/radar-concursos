export interface CollectorResult {
  provider: string;
  itemsFound: number;
  itemsCreated: number;
  itemsUpdated: number;
  startedAt: string;
  finishedAt: string;
}

export interface Collector<TStats = CollectorResult> {
  readonly name: string;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
  run(options?: { dryRun?: boolean }): Promise<TStats>;
  readonly stats: TStats | null;
}
