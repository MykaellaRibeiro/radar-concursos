export {};

const endpoint = process.env.RADAR_HEALTH_URL ?? "http://localhost:3000/api/health";

async function main() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal, headers: { accept: "application/json" } });
    const body = await response.json();
    console.info(JSON.stringify({ httpStatus: response.status, ...body }, null, 2));
    if (!response.ok || body.status !== "ok") process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
