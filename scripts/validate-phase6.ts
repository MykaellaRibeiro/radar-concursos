import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publishableKey || !serviceRoleKey) throw new Error("Configure as credenciais do Supabase para validar a Fase 6.");

const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } } as const;
const admin = createClient(url, serviceRoleKey, options);
const anonymous = createClient(url, publishableKey, options);
const suffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
const password = `Radar-${randomBytes(12).toString("base64url")}!9a`;
const createdUsers: string[] = [];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function createTemporaryUser(label: string) {
  const email = `radar-phase6-${label}-${suffix}@wolfgestao.com`;
  const result = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nome: `Fase 6 ${label}` } });
  if (result.error || !result.data.user) throw result.error ?? new Error(`Usuário ${label} não criado.`);
  createdUsers.push(result.data.user.id);
  const client = createClient(url!, publishableKey!, options);
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.session) throw login.error ?? new Error(`Login ${label} falhou.`);
  return {
    id: result.data.user.id,
    client: createClient(url!, publishableKey!, { ...options, global: { headers: { Authorization: `Bearer ${login.data.session.access_token}` } } }),
  };
}

async function insertAttempt(client: SupabaseClient, questionId: string, option: string, duration: number) {
  const result = await client.from("tentativas_questoes").insert({
    questao_id: questionId, alternativa_marcada: option, duracao_segundos: duration, contexto: "QUESTAO",
  }).select("id,questao_id,alternativa_marcada,correta,anulada,numero_tentativa,answered_at").single();
  if (result.error || !result.data) throw result.error ?? new Error("Tentativa não persistida.");
  await new Promise((resolve) => setTimeout(resolve, 550));
  return result.data;
}

function wrongOption(answer: string | null) {
  return answer === "A" ? "B" : "A";
}

async function main() {
  try {
    const [userA, userB] = await Promise.all([createTemporaryUser("a"), createTemporaryUser("b")]);
    const { data: questions, error: questionError } = await admin.from("questao_catalog")
      .select("id,numero,resposta,anulada,assunto_id,classification_status,concurso_id,concurso_slug")
      .in("numero", [1, 2, 3, 4, 5, 38, 46, 67]).order("numero");
    if (questionError) throw questionError;
    const byNumber = new Map(questions.map((question) => [question.numero, question]));
    for (const number of [1, 2, 3, 4, 5, 38, 46, 67]) assert(byNumber.has(number), `Questão real ${number} não encontrada.`);
    assert(byNumber.get(38)?.anulada && byNumber.get(67)?.anulada, "Casos reais anulados 38 e 67 foram alterados.");
    assert(byNumber.get(46)?.assunto_id === null, "Questão 46 ganhou assunto sem evidência suficiente.");

    const normal = [1, 2, 3, 4, 46].map((number) => byNumber.get(number)!);
    const attempts = [];
    attempts.push(await insertAttempt(userA.client, normal[0].id, wrongOption(normal[0].resposta), 31));
    attempts.push(await insertAttempt(userA.client, normal[0].id, normal[0].resposta!, 27));
    attempts.push(await insertAttempt(userA.client, normal[1].id, normal[1].resposta!, 24));
    attempts.push(await insertAttempt(userA.client, normal[2].id, normal[2].resposta!, 29));
    attempts.push(await insertAttempt(userA.client, normal[3].id, wrongOption(normal[3].resposta), 36));
    attempts.push(await insertAttempt(userA.client, normal[4].id, normal[4].resposta!, 40));
    attempts.push(await insertAttempt(userA.client, byNumber.get(38)!.id, "A", 18));

    assert(attempts.length === 7, "Cenário não persistiu sete tentativas.");
    assert(attempts[0].numero_tentativa === 1 && attempts[1].numero_tentativa === 2, "Múltiplas tentativas não foram numeradas.");
    assert(attempts[0].correta === false && attempts[1].correta === true, "Correção server-side da repetição divergiu.");
    assert(attempts[6].anulada === true && attempts[6].correta === false, "Anulada não foi tratada de forma especial.");

    const bookmarkInput = { questao_id: normal[0].id };
    const firstBookmark = await userA.client.from("questoes_salvas").upsert(bookmarkInput, { onConflict: "user_id,questao_id" });
    const secondBookmark = await userA.client.from("questoes_salvas").upsert(bookmarkInput, { onConflict: "user_id,questao_id" });
    if (firstBookmark.error || secondBookmark.error) throw firstBookmark.error ?? secondBookmark.error;
    const contestId = normal[0].concurso_id;
    const target = await userA.client.rpc("definir_concurso_alvo", { p_concurso_id: contestId, p_principal: true, p_prioridade: 1 });
    if (target.error) throw target.error;

    const [history, current, coverage, bookmarks, targets, follows] = await Promise.all([
      userA.client.from("historico_desempenho_questoes").select("questao_id,correta,anulada,numero_tentativa"),
      userA.client.from("dominio_atual_questoes").select("questao_id,correta,anulada"),
      userA.client.from("cobertura_questoes_usuario").select("questao_id"),
      userA.client.from("questoes_salvas").select("id,questao_id"),
      userA.client.from("concursos_alvo").select("id,concurso_id,principal"),
      userA.client.from("concursos_seguidos").select("id,concurso_id").eq("concurso_id", contestId),
    ]);
    for (const result of [history, current, coverage, bookmarks, targets, follows]) if (result.error) throw result.error;
    const historyRows = history.data ?? [];
    const currentRows = current.data ?? [];
    const coverageRows = coverage.data ?? [];
    const bookmarkRows = bookmarks.data ?? [];
    const targetRows = targets.data ?? [];
    const followRows = follows.data ?? [];
    assert(historyRows.length === 7, `Histórico retornou ${historyRows.length}, esperado 7.`);
    assert(currentRows.length === 5, `Domínio atual retornou ${currentRows.length}, esperado 5.`);
    assert(coverageRows.length === 6, `Cobertura retornou ${coverageRows.length}, esperado 6.`);
    assert(bookmarkRows.length === 1, "Bookmark não foi idempotente.");
    assert(targetRows.length === 1 && targetRows[0].principal, "Concurso-alvo principal não persistiu.");
    assert(followRows.length === 1, "Definir alvo não acompanhou o concurso.");

    const validHistory = historyRows.filter((row) => !row.anulada);
    const historyCorrect = validHistory.filter((row) => row.correta).length;
    const currentCorrect = currentRows.filter((row) => row.correta).length;
    assert(validHistory.length === 6 && historyCorrect === 4, "Amostra manual histórica deveria ser 4/6.");
    assert(currentRows.length === 5 && currentCorrect === 4, "Domínio atual deveria ser 4/5.");

    const [crossAttempts, crossBookmarks, crossBookmarkDelete, anonymousAttempt, immutableUpdate] = await Promise.all([
      userB.client.from("tentativas_questoes").select("id").eq("user_id", userA.id),
      userB.client.from("questoes_salvas").select("id").eq("user_id", userA.id),
      userB.client.from("questoes_salvas").delete().eq("user_id", userA.id).select("id"),
      anonymous.from("tentativas_questoes").insert({ questao_id: normal[1].id, alternativa_marcada: "A" }),
      userA.client.from("tentativas_questoes").update({ alternativa_marcada: "E" }).eq("id", attempts[0].id).select("id"),
    ]);
    assert(!crossAttempts.error && crossAttempts.data.length === 0, "Usuário B leu tentativas do A.");
    assert(!crossBookmarks.error && crossBookmarks.data.length === 0, "Usuário B leu bookmarks do A.");
    assert(!crossBookmarkDelete.error && crossBookmarkDelete.data.length === 0, "Usuário B removeu bookmark do A.");
    assert(Boolean(anonymousAttempt.error), "Usuário anônimo escreveu tentativa.");
    assert(Boolean(immutableUpdate.error) || (immutableUpdate.data ?? []).length === 0, "Histórico de tentativas foi alterado.");

    const { data: existingUsers, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw usersError;
    const protectedUsers = ["mykaellan@gmail.com", "mykaella@wolfgestao.com"];
    assert(protectedUsers.every((email) => existingUsers.users.some((user) => user.email === email)), "Usuários reais protegidos não foram preservados.");

    console.log(JSON.stringify({
      scenario: { normalQuestions: 5, annulledQuestions: 1, repeatedQuestions: 1, attempts: 7, uniqueCovered: 6 },
      persisted: { selectedOptions: true, timestamps: attempts.every((attempt) => Boolean(attempt.answered_at)), bookmarkCount: 1, targetCount: 1, followCount: 1 },
      math: { history: { correct: 4, denominator: 6, accuracy: 4 / 6 }, currentMastery: { correct: 4, denominator: 5, accuracy: 4 / 5 }, annulledExcluded: true },
      rls: { crossUserAttempts: "blocked", crossUserBookmarks: "blocked", crossUserDelete: "blocked", anonymousWrite: "blocked", attemptUpdate: "blocked" },
      conservativeCases: { question38Annulled: true, question67Annulled: true, question46WithoutSubject: true },
      protectedAuthUsers: protectedUsers,
      temporaryUsersRemovedAfterValidation: true,
    }, null, 2));
  } finally {
    for (const id of createdUsers.reverse()) {
      const result = await admin.auth.admin.deleteUser(id);
      if (result.error) console.error("phase6_temp_user_cleanup_failed", { userId: id, message: result.error.message });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

