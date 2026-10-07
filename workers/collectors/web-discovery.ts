import type { Collector } from "../../src/lib/collectors/types";
import { ExaSearchProvider } from "../../src/lib/providers/search/exa";
import type { SearchProvider } from "../../src/lib/providers/search/types";
import { runPredictedCollection, type PredictedCollectionSummary } from "./predicted-contests";

export class WebDiscoveryCollector implements Collector<PredictedCollectionSummary> {
  readonly name = "web_discovery_exa";
  stats: PredictedCollectionSummary | null = null;

  constructor(private readonly provider: SearchProvider = new ExaSearchProvider()) {}

  async healthCheck() {
    const health = await this.provider.healthCheck();
    return { ok: health.ok, message: health.message };
  }

  async run(options: { dryRun?: boolean } = {}) {
    this.stats = await runPredictedCollection({ provider: this.provider, dryRun: options.dryRun });
    return this.stats;
  }
}
