import { runExamIngestion } from "../workers/questions/ingest-exam";

function stringFlag(name: string): string | undefined {
  const argument = process.argv.find((value) => value.startsWith(`--${name}=`));
  return argument?.slice(name.length + 3);
}

async function main() {
  const summary = await runExamIngestion({
    proofId: stringFlag("proof"),
    allUnprocessed: process.argv.includes("--all-unprocessed"),
    dryRun: process.argv.includes("--dry-run"),
    force: process.argv.includes("--force"),
  });
  console.info(JSON.stringify(summary, null, 2));
  if (summary.errors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
