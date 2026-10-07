import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishableKey || !serviceRoleKey) {
  throw new Error("Configure as credenciais públicas do Supabase e SUPABASE_SERVICE_ROLE_KEY.");
}

const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } } as const;
const admin = createClient(url, serviceRoleKey, options);
const anonymous = createClient(url, publishableKey, options);
const proofId = "8d159a4e-c485-4cfb-8e4a-39ff79684150";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function exactCount(table: string) {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const tables = ["questoes", "disciplinas", "assuntos", "subassuntos", "questao_ingestoes"];
  const counts = Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await exactCount(table)])));

  const { data: questions, error: questionsError } = await admin
    .from("questoes")
    .select("id,numero,pagina,resposta,anulada,disciplina_id,assunto_id,subassunto_id,disciplina_status,disciplina_confidence,assunto_status,assunto_confidence,answer_key_verified,parser_version,classifier_version,content_hash")
    .eq("prova_id", proofId)
    .order("numero");
  if (questionsError) throw questionsError;

  assert(questions.length === 70, `A prova piloto retornou ${questions.length} questões, esperado 70.`);
  assert(questions.every((question, index) => question.numero === index + 1), "A numeração da prova não forma a sequência 1–70.");
  assert(questions.every((question) => question.pagina && (question.resposta || question.anulada) && question.answer_key_verified), "Há questão sem página, resultado oficial ou vínculo verificado com o gabarito.");
  assert(new Set(questions.map((question) => question.content_hash)).size === 70, "Os hashes das questões não são únicos.");
  assert(questions.every((question) => question.parser_version === "fgv-objective-v1.0.0"), "Há questão fora da versão esperada do parser.");
  assert(questions.every((question) => question.classifier_version === "pcma-rules-v1.0.2"), "Há questão fora da versão esperada do classificador.");

  const annulled = questions.filter((question) => question.anulada).map((question) => question.numero);
  assert(JSON.stringify(annulled) === JSON.stringify([38, 67]), `Questões anuladas divergentes: ${annulled.join(", ")}.`);

  const disciplineEligible = questions.filter((question) =>
    question.disciplina_status === "CONFIRMED" ||
    (question.disciplina_status === "AUTO_CLASSIFIED" && ["HIGH", "OFFICIAL"].includes(question.disciplina_confidence)),
  );
  const subjectEligible = questions.filter((question) =>
    question.assunto_id &&
    (question.assunto_status === "CONFIRMED" ||
      (question.assunto_status === "AUTO_CLASSIFIED" && ["HIGH", "OFFICIAL"].includes(question.assunto_confidence))),
  );
  assert(disciplineEligible.length === 70, `Amostra elegível por disciplina: ${disciplineEligible.length}, esperado 70.`);
  assert(subjectEligible.length === 69, `Amostra elegível por assunto: ${subjectEligible.length}, esperado 69.`);

  const [{ data: catalog, error: catalogError }, { data: disciplineStats, error: disciplineStatsError }, { data: subjectStats, error: subjectStatsError }] = await Promise.all([
    anonymous.from("questao_catalog").select("id,numero,anulada,disciplina_nome,assunto_nome,prova_source_url,gabarito_source_url").eq("prova_id", proofId).order("numero"),
    anonymous.from("estatisticas_prova_disciplinas").select("question_count,sample_size,is_small_sample").eq("prova_id", proofId),
    anonymous.from("estatisticas_prova_assuntos").select("question_count,sample_size,is_small_sample").eq("prova_id", proofId),
  ]);
  if (catalogError) throw catalogError;
  if (disciplineStatsError) throw disciplineStatsError;
  if (subjectStatsError) throw subjectStatsError;

  assert(catalog.length === 70, `O catálogo anônimo retornou ${catalog.length} questões.`);
  assert(catalog.every((question) => question.prova_source_url && question.gabarito_source_url), "O catálogo público perdeu a proveniência oficial.");
  assert(disciplineStats.reduce((sum, row) => sum + row.question_count, 0) === 70, "A view de disciplinas não totaliza 70.");
  assert(subjectStats.reduce((sum, row) => sum + row.question_count, 0) === 69, "A view de assuntos não totaliza 69.");
  assert(disciplineStats.every((row) => row.sample_size === 70 && row.is_small_sample === false), "A amostra por disciplina não expõe n=70 corretamente.");
  assert(subjectStats.every((row) => row.sample_size === 69 && row.is_small_sample === false), "A amostra por assunto não expõe n=69 corretamente.");

  const anonymousWrite = await anonymous.from("questoes").update({ classification_reason: "security-probe" }).eq("id", questions[0].id).select("id");
  assert(Boolean(anonymousWrite.error), "Anon conseguiu alterar uma questão pública.");

  const { data: ingestions, error: ingestionsError } = await admin
    .from("questao_ingestoes")
    .select("status,questoes_encontradas,questoes_inseridas,questoes_atualizadas,respostas_vinculadas,erros,parser_version,classifier_version,started_at")
    .eq("prova_id", proofId)
    .order("started_at", { ascending: false });
  if (ingestionsError) throw ingestionsError;
  assert(ingestions.length >= 2, "Não há histórico suficiente para provar ingestão e reexecução idempotente.");
  assert(ingestions.every((run) => run.status === "SUCCESS" && Array.isArray(run.erros) && run.erros.length === 0), "Há execução de ingestão com falha ou erros.");
  assert(ingestions.some((run) => run.questoes_inseridas === 0 && run.questoes_atualizadas === 0 && run.questoes_encontradas === 70), "Não foi encontrada uma reexecução idempotente sem alterações.");

  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw usersError;

  console.log(JSON.stringify({
    counts,
    pilot: {
      proofId,
      questions: questions.length,
      answersLinked: questions.filter((question) => question.answer_key_verified).length,
      answerLetters: questions.filter((question) => Boolean(question.resposta)).length,
      annulled,
      disciplinesEligible: disciplineEligible.length,
      subjectsEligible: subjectEligible.length,
      subsubjectsClassified: questions.filter((question) => Boolean(question.subassunto_id)).length,
      parserVersion: questions[0].parser_version,
      classifierVersion: questions[0].classifier_version,
    },
    publicRead: {
      catalogRows: catalog.length,
      disciplineSample: disciplineStats[0]?.sample_size ?? 0,
      subjectSample: subjectStats[0]?.sample_size ?? 0,
      provenancePresent: true,
    },
    security: {
      anonymousRead: "ok",
      anonymousWrite: "blocked",
      databaseErrorCode: anonymousWrite.error?.code,
    },
    ingestion: {
      runs: ingestions.length,
      successful: ingestions.filter((run) => run.status === "SUCCESS").length,
      idempotentRunPresent: true,
      latest: ingestions[0],
    },
    auth: {
      users: users.users.length,
      confirmedUsers: users.users.filter((user) => Boolean(user.email_confirmed_at)).length,
      emails: users.users.map((user) => user.email ?? null),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
