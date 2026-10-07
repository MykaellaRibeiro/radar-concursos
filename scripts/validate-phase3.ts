import { createClient, type SupabaseClient } from "@supabase/supabase-js";

async function count(client: SupabaseClient, table: string) {
  const { count: total, error } = await client.from(table).select("id", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return total ?? 0;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) throw new Error("Credenciais Supabase ausentes.");
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const tables = ["concursos", "orgaos", "cargos", "movimentacoes", "movimentacao_fontes", "fontes", "orgao_aliases", "web_discoveries", "notificacoes", "coletas"];
  const counts = Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await count(admin, table)])));
  const { data: predicted, error: predictedError, count: predictedCount } = await anon.from("concurso_search")
    .select("id,slug,titulo,status,confidence,vagas_previstas,latest_movement_title,source_count", { count: "exact" })
    .in("status", ["SOLICITADO", "ANUNCIADO", "PREVISTO", "AUTORIZADO", "COMISSAO_FORMADA", "BANCA_EM_DEFINICAO", "BANCA_DEFINIDA", "BANCA_CONTRATADA", "EDITAL_EM_ELABORACAO", "EDITAL_IMINENTE"]).limit(3);
  if (predictedError) throw new Error(`concurso_search público: ${predictedError.message}`);
  const privateAttempt = await anon.from("web_discoveries").select("id").limit(1);
  const { data: codeba, error: codebaError } = await admin.from("concursos")
    .select("id,slug,titulo,status,confidence,uf,regiao,vagas_total,vagas_previstas,banca_status,banca_observacao,orgaos(nome,sigla),movimentacoes(id,titulo,event_date,confidence,movimentacao_fontes(titulo,url,fontes(nome,tipo)))")
    .eq("slug", "concurso-companhia-docas-estado-bahia-ba-2026")
    .single();
  if (codebaError) throw new Error(`CODEBA persistida: ${codebaError.message}`);
  const { data: users, error: userError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (userError) throw userError;
  console.log(JSON.stringify({
    counts,
    predictedCount,
    predictedSample: predicted,
    persistedCodeba: codeba,
    rls: {
      publicCatalogReadable: true,
      operationalDiscoveryBlockedForAnon: Boolean(privateAttempt.error),
      operationalDiscoveryErrorCode: privateAttempt.error?.code ?? null,
    },
    authUsers: users.users.map((user) => ({ id: user.id, emailConfirmed: Boolean(user.email_confirmed_at), createdAt: user.created_at })),
  }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
