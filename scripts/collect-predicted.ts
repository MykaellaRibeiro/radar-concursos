import { WebDiscoveryCollector } from "../workers/collectors/web-discovery";

const dryRun = process.argv.slice(2).includes("--dry-run");
const collector = new WebDiscoveryCollector();

collector.run({ dryRun })
  .then((summary) => console.info(JSON.stringify(summary, null, 2)))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
