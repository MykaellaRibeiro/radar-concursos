import { createClient } from "@/lib/supabase/server";
import { getBoardQuestionInsights, getContestQuestionInsights, getGlobalQuestionInsights } from "@/features/questions/data/repository";
import { calculatePerformanceMetrics } from "../domain/metrics";
import { calculateStudyPriority } from "../domain/study-priority";
import type { ContestTarget, DimensionPerformance, PersonalStudyOverview } from "../types";

type HistoryRow = {
  tentativa_id: string;
  user_id: string;
  questao_id: string;
  alternativa_marcada: string;
  correta: boolean;
  anulada: boolean;
  numero_tentativa: number;
  duracao_segundos: number | null;
  contexto: string;
  answered_at: string;
  questao_numero: number;
  enunciado: string;
  disciplina_id: string | null;
  disciplina_slug: string | null;
  disciplina_nome: string | null;
  assunto_id: string | null;
  assunto_slug: string | null;
  assunto_nome: string | null;
  subassunto_id: string | null;
  subassunto_slug: string | null;
  subassunto_nome: string | null;
  banca_id: string | null;
  banca_slug: string | null;
  banca_nome: string | null;
  concurso_id: string;
  concurso_slug: string;
  concurso_titulo: string;
};

type AvailableRow = {
  id: string;
  disciplina_id: string | null;
  disciplina_slug: string | null;
  disciplina_nome: string | null;
  assunto_id: string | null;
  assunto_slug: string | null;
  assunto_nome: string | null;
  banca_id: string | null;
  banca_slug: string | null;
  banca_nome: string | null;
};

type TargetRow = {
  id: string;
  concurso_id: string;
  prioridade: number;
  principal: boolean;
  concursos: {
    slug: string;
    titulo: string;
    status: string;
    confidence: string;
    uf: string | null;
    concursos_bancas: Array<{ bancas: { slug: string; nome: string } | null }>;
  } | null;
};

const toMetricInput = (row: HistoryRow) => ({
  questionId: row.questao_id,
  correct: row.correta,
  annulled: row.anulada,
  answeredAt: row.answered_at,
  durationSeconds: row.duracao_segundos,
});

function groupPerformance(
  current: HistoryRow[],
  history: HistoryRow[],
  available: AvailableRow[],
  dimension: "discipline" | "subject" | "board",
): DimensionPerformance[] {
  const fields = dimension === "discipline"
    ? { id: "disciplina_id", slug: "disciplina_slug", label: "disciplina_nome" }
    : dimension === "subject"
      ? { id: "assunto_id", slug: "assunto_slug", label: "assunto_nome" }
      : { id: "banca_id", slug: "banca_slug", label: "banca_nome" };
  const availableById = new Map<string, { slug: string; label: string; ids: Set<string> }>();
  for (const row of available) {
    const id = row[fields.id as keyof AvailableRow] as string | null;
    const slug = row[fields.slug as keyof AvailableRow] as string | null;
    const label = row[fields.label as keyof AvailableRow] as string | null;
    if (!id || !slug || !label) continue;
    const entry = availableById.get(id) ?? { slug, label, ids: new Set<string>() };
    entry.ids.add(row.id);
    availableById.set(id, entry);
  }
  return [...availableById.entries()].map(([id, meta]) => {
    const mastered = current.filter((row) => row[fields.id as keyof HistoryRow] === id);
    const seen = new Set(history.filter((row) => row[fields.id as keyof HistoryRow] === id).map((row) => row.questao_id));
    const correct = mastered.filter((row) => row.correta).length;
    return {
      id,
      slug: meta.slug,
      label: meta.label,
      available: meta.ids.size,
      answered: seen.size,
      validAnswered: mastered.length,
      correct,
      accuracy: mastered.length ? correct / mastered.length : null,
      coverage: meta.ids.size ? seen.size / meta.ids.size : 0,
      lastActivity: history.filter((row) => row[fields.id as keyof HistoryRow] === id)
        .sort((left, right) => right.answered_at.localeCompare(left.answered_at))[0]?.answered_at ?? null,
    };
  }).filter((item) => item.answered > 0).sort((left, right) => right.answered - left.answered || left.label.localeCompare(right.label, "pt-BR"));
}

function mapTargets(rows: TargetRow[]): ContestTarget[] {
  return rows.flatMap((row) => {
    if (!row.concursos) return [];
    const board = row.concursos.concursos_bancas[0]?.bancas ?? null;
    return [{
      id: row.id,
      contestId: row.concurso_id,
      slug: row.concursos.slug,
      title: row.concursos.titulo,
      status: row.concursos.status,
      confidence: row.concursos.confidence,
      state: row.concursos.uf,
      primary: row.principal,
      priority: row.prioridade,
      boardSlug: board?.slug ?? null,
      boardName: board?.nome ?? null,
    }];
  });
}

export async function getPersonalStudyOverview(): Promise<PersonalStudyOverview> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    const empty = calculatePerformanceMetrics([]);
    return {
      authenticated: false, history: empty, current: empty, today: empty, last7Days: empty,
      availableQuestions: 0, coverage: 0, savedCount: 0, currentErrors: 0,
      disciplines: [], subjects: [], boards: [], targets: [], recent: [], priorities: [],
      priorityScope: "GLOBAL", priorityScopeLabel: "base global",
    };
  }

  const [historyResult, currentResult, availableResult, targetsResult, savedResult] = await Promise.all([
    supabase.from("historico_desempenho_questoes").select("*").order("answered_at", { ascending: false }).limit(2000),
    supabase.from("dominio_atual_questoes").select("*").order("answered_at", { ascending: false }).limit(1000),
    supabase.from("questao_catalog").select("id,disciplina_id,disciplina_slug,disciplina_nome,assunto_id,assunto_slug,assunto_nome,banca_id,banca_slug,banca_nome"),
    supabase.from("concursos_alvo").select("id,concurso_id,prioridade,principal,concursos(slug,titulo,status,confidence,uf,concursos_bancas(bancas(slug,nome)))").order("principal", { ascending: false }).order("prioridade", { ascending: false }),
    supabase.from("questoes_salvas").select("id", { count: "exact", head: true }),
  ]);
  for (const result of [historyResult, currentResult, availableResult, targetsResult]) if (result.error) throw result.error;
  const history = historyResult.data as unknown as HistoryRow[];
  const current = currentResult.data as unknown as HistoryRow[];
  const available = availableResult.data as unknown as AvailableRow[];
  const targets = mapTargets(targetsResult.data as unknown as TargetRow[]);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(Date.now() - 7 * 86_400_000);
  const primary = targets.find((target) => target.primary) ?? targets[0];

  let insights = primary ? await getContestQuestionInsights(primary.slug) : await getGlobalQuestionInsights();
  let priorityScope: PersonalStudyOverview["priorityScope"] = primary && insights.sampleSize ? "CONTEST" : "GLOBAL";
  let priorityScopeLabel = primary && insights.sampleSize ? primary.title : "base global";
  if (primary && !insights.sampleSize && primary.boardSlug) {
    const boardInsights = await getBoardQuestionInsights(primary.boardSlug);
    if (boardInsights.sampleSize) {
      insights = boardInsights;
      priorityScope = "BOARD";
      priorityScopeLabel = primary.boardName ?? "banca do concurso-alvo";
    }
  }
  if (!insights.sampleSize) insights = await getGlobalQuestionInsights();

  const disciplines = groupPerformance(current, history, available, "discipline");
  const subjects = groupPerformance(current, history, available, "subject");
  const boards = groupPerformance(current, history, available, "board");
  const priorities = insights.disciplines.map((incidence) => {
    const performance = disciplines.find((item) => item.id === incidence.id);
    return calculateStudyPriority({
      id: incidence.id,
      label: incidence.label,
      historicalCount: incidence.count,
      historicalPercentage: incidence.percentage,
      answeredCount: performance?.validAnswered ?? 0,
      correctCount: performance?.correct ?? 0,
      lastAnsweredAt: performance?.lastActivity ?? null,
      targetRelevance: priorityScope,
    });
  }).sort((left, right) => (right.score ?? -1) - (left.score ?? -1));

  const uniqueSeen = new Set(history.map((row) => row.questao_id)).size;
  return {
    authenticated: true,
    history: calculatePerformanceMetrics(history.map(toMetricInput)),
    current: calculatePerformanceMetrics(current.map(toMetricInput)),
    today: calculatePerformanceMetrics(history.filter((row) => Date.parse(row.answered_at) >= todayStart.getTime()).map(toMetricInput)),
    last7Days: calculatePerformanceMetrics(history.filter((row) => Date.parse(row.answered_at) >= weekStart.getTime()).map(toMetricInput)),
    availableQuestions: available.length,
    coverage: available.length ? uniqueSeen / available.length : 0,
    savedCount: savedResult.error ? 0 : (savedResult.count ?? 0),
    currentErrors: current.filter((row) => !row.correta).length,
    disciplines,
    subjects,
    boards,
    targets,
    recent: history.slice(0, 8).map((row) => ({
      id: row.tentativa_id, questionId: row.questao_id, questionNumber: row.questao_numero,
      statement: row.enunciado, correct: row.correta, annulled: row.anulada,
      answeredAt: row.answered_at, discipline: row.disciplina_nome,
    })),
    priorities,
    priorityScope,
    priorityScopeLabel,
  };
}

export async function getQuestionPersonalState(questionId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { authenticated: false, bookmarked: false, attempt: null };
  const [attemptResult, bookmarkResult] = await Promise.all([
    supabase.from("tentativas_questoes").select("alternativa_marcada,correta,anulada,numero_tentativa,answered_at").eq("questao_id", questionId).order("numero_tentativa", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("questoes_salvas").select("id").eq("questao_id", questionId).maybeSingle(),
  ]);
  if (attemptResult.error) throw attemptResult.error;
  if (bookmarkResult.error) throw bookmarkResult.error;
  return { authenticated: true, bookmarked: Boolean(bookmarkResult.data), attempt: attemptResult.data };
}

export async function getContestPreparation(slug: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const availableResult = await supabase.from("questao_catalog").select("id,disciplina_id,disciplina_slug,disciplina_nome,assunto_id,assunto_slug,assunto_nome,banca_id,banca_slug,banca_nome").eq("concurso_slug", slug);
  if (availableResult.error) throw availableResult.error;
  const available = availableResult.data as unknown as AvailableRow[];
  if (!auth.user) return { authenticated: false, available: available.length, current: calculatePerformanceMetrics([]), coverage: 0, disciplines: [] as DimensionPerformance[], priorities: [] };
  const [historyResult, currentResult, insights] = await Promise.all([
    supabase.from("historico_desempenho_questoes").select("*").eq("concurso_slug", slug).order("answered_at", { ascending: false }),
    supabase.from("dominio_atual_questoes").select("*").eq("concurso_slug", slug).order("answered_at", { ascending: false }),
    getContestQuestionInsights(slug),
  ]);
  if (historyResult.error) throw historyResult.error;
  if (currentResult.error) throw currentResult.error;
  const history = historyResult.data as unknown as HistoryRow[];
  const current = currentResult.data as unknown as HistoryRow[];
  const disciplines = groupPerformance(current, history, available, "discipline");
  const priorities = insights.disciplines.map((incidence) => {
    const performance = disciplines.find((item) => item.id === incidence.id);
    return calculateStudyPriority({
      id: incidence.id, label: incidence.label, historicalCount: incidence.count,
      historicalPercentage: incidence.percentage, answeredCount: performance?.validAnswered ?? 0,
      correctCount: performance?.correct ?? 0, lastAnsweredAt: performance?.lastActivity ?? null,
      targetRelevance: "CONTEST",
    });
  }).sort((left, right) => (right.score ?? -1) - (left.score ?? -1));
  const seen = new Set(history.map((row) => row.questao_id)).size;
  return {
    authenticated: true,
    available: available.length,
    current: calculatePerformanceMetrics(current.map(toMetricInput)),
    coverage: available.length ? seen / available.length : 0,
    disciplines,
    priorities,
  };
}

export async function listSavedQuestionIds() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { authenticated: false, ids: [] as string[] };
  const { data, error } = await supabase.from("questoes_salvas").select("questao_id").order("created_at", { ascending: false });
  if (error) throw error;
  return { authenticated: true, ids: data.map((row) => row.questao_id) };
}

export async function listCurrentErrorIds() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase.from("dominio_atual_questoes").select("questao_id").eq("correta", false);
  if (error) throw error;
  return data.map((row) => row.questao_id);
}

export async function listAnsweredQuestionIds() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase.from("cobertura_questoes_usuario").select("questao_id");
  if (error) throw error;
  return data.map((row) => row.questao_id);
}
