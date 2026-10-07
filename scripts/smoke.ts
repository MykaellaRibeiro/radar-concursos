export {};

const base = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const routes = [
  "/", "/login", "/dashboard", "/concursos", "/concursos/abertos", "/concursos/previstos",
  "/concursos/policia-civil-do-maranhao-2012", "/provas", "/provas/8d159a4e-c485-4cfb-8e4a-39ff79684150",
  "/questoes/29e88356-5393-437a-9d98-6f711958550e", "/estatisticas", "/estudar", "/meus-concursos",
  "/questoes/salvas", "/robots.txt", "/sitemap.xml", "/api/health",
];
const results: Array<{ path: string; status: number | null; ok: boolean; error?: string }> = [];

async function main() {
  for (const path of routes) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${base}${path}`, { signal: controller.signal, redirect: "manual" });
      results.push({ path, status: response.status, ok: response.status >= 200 && response.status < 400 });
    } catch (error) {
      results.push({ path, status: null, ok: false, error: error instanceof Error ? error.name : "Error" });
    } finally {
      clearTimeout(timeout);
    }
  }
  console.info(JSON.stringify({ base, results }, null, 2));
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
