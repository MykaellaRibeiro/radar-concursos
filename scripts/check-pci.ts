import { PciConcursosProvider } from "../src/lib/providers/concursos/pci";

async function main() {
  const provider = new PciConcursosProvider({ timeoutMs: 45_000, retries: 1 });
  const health = await provider.healthCheck();
  if (!health.ok) throw new Error(health.error ?? "MCP PCI indisponível ou contrato incompleto.");
  const contests = await provider.listOpen({ limit: 3 });
  console.info(JSON.stringify({ health, call: provider.lastCallStats, sample: contests.map((item) => ({ externalId: item.externalId, title: item.title, state: item.state, sourceUrl: item.source.sourceUrl })) }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
