import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publishableKey || !serviceRoleKey) throw new Error("Configure as credenciais Supabase para validar a Fase 7.");

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
const collector = `phase7_validation_${Date.now()}`;
const runIds: string[] = [];
let temporaryUserId: string | null = null;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
try {
  const first = await admin.rpc("begin_collector_run", { p_collector: collector, p_provider: "validation", p_ttl_seconds: 60, p_metadata: { owner: "phase7-validation" } });
  assert(!first.error, `Primeiro lock falhou: ${first.error?.message}`);
  const firstRow = (first.data as Array<{ run_status: string; run_id: string | null }>)[0];
  assert(firstRow?.run_status === "acquired" && firstRow.run_id, "Primeira execução não adquiriu o lock.");
  runIds.push(firstRow.run_id);

  const concurrent = await admin.rpc("begin_collector_run", { p_collector: collector, p_provider: "validation", p_ttl_seconds: 60, p_metadata: { owner: "phase7-concurrent" } });
  assert(!concurrent.error, `Segundo lock falhou inesperadamente: ${concurrent.error?.message}`);
  const concurrentRow = (concurrent.data as Array<{ run_status: string; run_id: string | null }>)[0];
  assert(concurrentRow?.run_status === "already_running" && concurrentRow.run_id === null, "Execução concorrente não foi bloqueada.");

  const anonymous = await anon.rpc("begin_collector_run", { p_collector: collector, p_provider: "validation", p_ttl_seconds: 60, p_metadata: {} });
  assert(Boolean(anonymous.error), "Anon conseguiu iniciar collector operacional.");

  const heartbeat = await admin.rpc("heartbeat_collector_run", { p_run_id: firstRow.run_id, p_ttl_seconds: 60 });
  assert(!heartbeat.error && heartbeat.data === true, "Heartbeat do lock falhou.");

  const finished = await admin.rpc("finish_collector_run", {
    p_run_id: firstRow.run_id, p_status: "SUCCESS", p_items_found: 1, p_items_created: 0,
    p_items_updated: 0, p_items_unchanged: 1, p_items_rejected: 0, p_error_count: 0,
    p_error_message: null, p_metadata: { validation: true },
  });
  assert(!finished.error && finished.data === true, "Finalização operacional falhou.");

  const afterFinish = await admin.rpc("begin_collector_run", { p_collector: collector, p_provider: "validation", p_ttl_seconds: 60, p_metadata: { owner: "phase7-after-finish" } });
  assert(!afterFinish.error, `Reaquisição falhou: ${afterFinish.error?.message}`);
  const afterRow = (afterFinish.data as Array<{ run_status: string; run_id: string | null }>)[0];
  assert(afterRow?.run_status === "acquired" && afterRow.run_id, "Lock não foi liberado após finalização.");
  runIds.push(afterRow.run_id);
  await admin.rpc("finish_collector_run", {
    p_run_id: afterRow.run_id, p_status: "SUCCESS", p_items_found: 0, p_items_created: 0,
    p_items_updated: 0, p_items_unchanged: 0, p_items_rejected: 0, p_error_count: 0,
    p_error_message: null, p_metadata: { validation: true },
  });

  const bucketResult = await admin.storage.listBuckets();
  assert(!bucketResult.error, `Não foi possível listar Storage: ${bucketResult.error?.message}`);
  const bucket = bucketResult.data.find((item) => item.id === "radar-documentos");
  assert(bucket?.public === true, "Bucket radar-documentos não está disponível para leitura pública.");

  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assert(!users.error, `Não foi possível listar Auth: ${users.error?.message}`);
  const protectedEmails = ["mykaellan@gmail.com", "mykaella@wolfgestao.com"];
  for (const email of protectedEmails) assert(users.data.users.some((user) => user.email === email), `Conta protegida ausente: ${email}`);

  const temporaryUser = await admin.auth.admin.createUser({
    email: `radar-phase7-notification-${Date.now()}@wolfgestao.com`,
    password: `Phase7-${crypto.randomUUID()}!`,
    email_confirm: true,
  });
  assert(!temporaryUser.error && temporaryUser.data.user, `Falha ao criar usuário temporário: ${temporaryUser.error?.message}`);
  temporaryUserId = temporaryUser.data.user.id;
  const movement = await admin.from("movimentacoes").select("id,concurso_id").not("concurso_id", "is", null).limit(1).single();
  assert(!movement.error && movement.data, `Falha ao localizar movimentação real: ${movement.error?.message}`);
  const movementRow = movement.data;
  const follow = await admin.from("concursos_seguidos").insert({ user_id: temporaryUserId, concurso_id: movementRow.concurso_id });
  assert(!follow.error, `Falha ao seguir concurso no teste: ${follow.error?.message}`);
  const notificationKey = `phase7-validation:${movementRow.id}:${temporaryUserId}`;
  async function createNotificationOnce() {
    const present = await admin.from("notificacoes").select("id").eq("deduplication_key", notificationKey).maybeSingle();
    assert(!present.error, `Falha ao consultar notificação: ${present.error?.message}`);
    if (present.data) return 0;
    const inserted = await admin.from("notificacoes").insert({
      user_id: temporaryUserId,
      concurso_id: movementRow.concurso_id,
      movimentacao_id: movementRow.id,
      titulo: "Validação operacional",
      mensagem: "Registro temporário da validação de deduplicação.",
      deduplication_key: notificationKey,
    });
    assert(!inserted.error, `Falha ao criar notificação: ${inserted.error?.message}`);
    return 1;
  }
  const firstNotification = await createNotificationOnce();
  const repeatedNotification = await createNotificationOnce();
  const notificationCount = await admin.from("notificacoes").select("id", { count: "exact", head: true }).eq("deduplication_key", notificationKey);
  assert(!notificationCount.error && notificationCount.count === 1, "A notificação temporária não foi deduplicada.");
  assert(firstNotification === 1 && repeatedNotification === 0, "A segunda passagem criou uma notificação duplicada.");
  const deletedTemporaryUser = await admin.auth.admin.deleteUser(temporaryUserId);
  assert(!deletedTemporaryUser.error, `Falha ao remover usuário temporário: ${deletedTemporaryUser.error?.message}`);
  temporaryUserId = null;

  const mainTables = [
    "concursos", "orgaos", "cargos", "provas", "questoes", "fontes", "movimentacoes",
    "editais", "gabaritos", "arquivos", "notificacoes", "tentativas_questoes", "coletas",
  ];
  const countEntries = await Promise.all(mainTables.map(async (table) => {
    const result = await admin.from(table).select("*", { count: "exact", head: true });
    assert(!result.error, `Falha ao contar ${table}: ${result.error?.message}`);
    return [table, result.count ?? 0] as const;
  }));

  console.info(JSON.stringify({
    lock: "acquired",
    concurrent: "already_running",
    released: true,
    anonymousRpc: "blocked",
    storageBucket: { id: bucket.id, public: bucket.public },
    authUsers: users.data.users.length,
    protectedUsersPreserved: protectedEmails.length,
    notificationDeduplication: { firstCreated: 1, repeatedCreated: 0, rows: 1 },
    counts: Object.fromEntries(countEntries),
  }, null, 2));
} finally {
  if (runIds.length) await admin.from("coletas").delete().in("id", runIds);
  if (temporaryUserId) await admin.auth.admin.deleteUser(temporaryUserId);
}
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
