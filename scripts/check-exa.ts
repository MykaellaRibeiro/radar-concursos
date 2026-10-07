import { ExaSearchProvider } from "../src/lib/providers/search/exa";

async function main() {
  const provider = new ExaSearchProvider();
  const health = await provider.healthCheck();
  if (!health.ok) throw new Error(health.message);
  const sample = await provider.searchRecent("concurso público autorizado comissão formada banca definida Brasil", 7, { limit: 3 });
  if (!sample.length) throw new Error("Exa respondeu sem resultados normalizados.");
  console.log(JSON.stringify({ health, results: sample.map(({ title, url, domain, publishedAt }) => ({ title, url, domain, publishedAt })) }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
