import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface QuestionListFilters {
  discipline?: string;
  subject?: string;
  subsubject?: string;
  board?: string;
  contest?: string;
  proof?: string;
  year?: number;
  status?: string;
}

export interface QuestionCatalogItem {
  id: string;
  proofId: string;
  number: number;
  type: string;
  page: number | null;
  statement: string;
  alternatives: Array<{ letter: "A" | "B" | "C" | "D" | "E"; text: string | null }>;
  answer: string | null;
  annulled: boolean;
  parseQuality: number;
  classificationStatus: string;
  classificationConfidence: string;
  discipline: { id: string; name: string; slug: string } | null;
  subject: { id: string; name: string; slug: string } | null;
  subsubject: { id: string; name: string; slug: string } | null;
  proofTitle: string;
  year: number | null;
  contestSlug: string;
  contestTitle: string;
  boardSlug: string | null;
  boardName: string | null;
  roleName: string | null;
  proofSourceUrl: string | null;
  answerKeySourceUrl: string | null;
}

export interface RankedStatistic {
  id: string;
  slug: string;
  label: string;
  count: number;
  percentage: number;
}

export interface QuestionInsights {
  proofCount: number;
  sampleSize: number;
  minimumSampleSize: number;
  isSmallSample: boolean;
  disciplines: RankedStatistic[];
  subjects: RankedStatistic[];
}

export interface StatisticsFilters {
  board?: string;
  year?: number;
  role?: string;
  discipline?: string;
}

type CatalogRow = {
  id: string; prova_id: string; numero: number; tipo: string; pagina: number | null; enunciado: string;
  alternativa_a: string | null; alternativa_b: string | null; alternativa_c: string | null; alternativa_d: string | null; alternativa_e: string | null;
  resposta: string | null; anulada: boolean; parse_quality: number | string; classification_status: string; classification_confidence: string;
  disciplina_id: string | null; disciplina_nome: string | null; disciplina_slug: string | null;
  assunto_id: string | null; assunto_nome: string | null; assunto_slug: string | null;
  subassunto_id: string | null; subassunto_nome: string | null; subassunto_slug: string | null;
  prova_titulo: string; ano: number | null; concurso_slug: string; concurso_titulo: string;
  banca_slug: string | null; banca_nome: string | null; cargo_nome: string | null;
  prova_source_url: string | null; gabarito_source_url: string | null;
};

type StatisticRow = {
  prova_id: string;
  disciplina_id: string;
  disciplina_slug: string;
  disciplina_nome: string;
  assunto_id?: string;
  assunto_slug?: string;
  assunto_nome?: string;
  question_count: number | string;
  sample_size: number | string;
  is_small_sample: boolean;
};

function mapQuestion(row: CatalogRow): QuestionCatalogItem {
  return {
    id: row.id,
    proofId: row.prova_id,
    number: row.numero,
    type: row.tipo,
    page: row.pagina,
    statement: row.enunciado,
    alternatives: [
      { letter: "A", text: row.alternativa_a },
      { letter: "B", text: row.alternativa_b },
      { letter: "C", text: row.alternativa_c },
      { letter: "D", text: row.alternativa_d },
      { letter: "E", text: row.alternativa_e },
    ],
    answer: row.resposta,
    annulled: row.anulada,
    parseQuality: Number(row.parse_quality),
    classificationStatus: row.classification_status,
    classificationConfidence: row.classification_confidence,
    discipline: row.disciplina_id && row.disciplina_nome && row.disciplina_slug
      ? { id: row.disciplina_id, name: row.disciplina_nome, slug: row.disciplina_slug } : null,
    subject: row.assunto_id && row.assunto_nome && row.assunto_slug
      ? { id: row.assunto_id, name: row.assunto_nome, slug: row.assunto_slug } : null,
    subsubject: row.subassunto_id && row.subassunto_nome && row.subassunto_slug
      ? { id: row.subassunto_id, name: row.subassunto_nome, slug: row.subassunto_slug } : null,
    proofTitle: row.prova_titulo,
    year: row.ano,
    contestSlug: row.concurso_slug,
    contestTitle: row.concurso_titulo,
    boardSlug: row.banca_slug,
    boardName: row.banca_nome,
    roleName: row.cargo_nome,
    proofSourceUrl: row.prova_source_url,
    answerKeySourceUrl: row.gabarito_source_url,
  };
}

const questionSelect = "id,prova_id,numero,tipo,pagina,enunciado,alternativa_a,alternativa_b,alternativa_c,alternativa_d,alternativa_e,resposta,anulada,parse_quality,classification_status,classification_confidence,disciplina_id,disciplina_nome,disciplina_slug,assunto_id,assunto_nome,assunto_slug,subassunto_id,subassunto_nome,subassunto_slug,prova_titulo,ano,concurso_slug,concurso_titulo,banca_slug,banca_nome,cargo_nome,prova_source_url,gabarito_source_url";

export async function listProofQuestions(proofId: string, filters: QuestionListFilters = {}) {
  if (!isSupabaseConfigured) return { items: [] as QuestionCatalogItem[], disciplines: [], subjects: [], statuses: [] };
  const supabase = await createClient();
  let query = supabase.from("questao_catalog").select(questionSelect).eq("prova_id", proofId);
  if (filters.discipline) query = query.eq("disciplina_slug", filters.discipline);
  if (filters.subject) query = query.eq("assunto_slug", filters.subject);
  if (filters.status) query = query.eq("classification_status", filters.status);
  const [filtered, optionRows] = await Promise.all([
    query.order("numero"),
    supabase.from("questao_catalog").select("disciplina_nome,disciplina_slug,assunto_nome,assunto_slug,classification_status").eq("prova_id", proofId).order("numero"),
  ]);
  if (filtered.error) throw filtered.error;
  if (optionRows.error) throw optionRows.error;
  const options = optionRows.data;
  return {
    items: (filtered.data as unknown as CatalogRow[]).map(mapQuestion),
    disciplines: [...new Map(options.flatMap((row) => row.disciplina_slug && row.disciplina_nome ? [[row.disciplina_slug, row.disciplina_nome] as const] : [])).entries()].map(([slug, name]) => ({ slug, name })),
    subjects: [...new Map(options.flatMap((row) => row.assunto_slug && row.assunto_nome ? [[row.assunto_slug, row.assunto_nome] as const] : [])).entries()].map(([slug, name]) => ({ slug, name })),
    statuses: [...new Set(options.map((row) => row.classification_status))].sort(),
  };
}

export async function getQuestion(id: string): Promise<QuestionCatalogItem | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("questao_catalog").select(questionSelect).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapQuestion(data as unknown as CatalogRow) : null;
}

export async function listQuestions(filters: QuestionListFilters = {}, ids?: string[]) {
  if (!isSupabaseConfigured || ids?.length === 0) return [] as QuestionCatalogItem[];
  const supabase = await createClient();
  let query = supabase.from("questao_catalog").select(questionSelect);
  if (filters.discipline) query = query.eq("disciplina_slug", filters.discipline);
  if (filters.subject) query = query.eq("assunto_slug", filters.subject);
  if (filters.subsubject) query = query.eq("subassunto_slug", filters.subsubject);
  if (filters.board) query = query.eq("banca_slug", filters.board);
  if (filters.contest) query = query.eq("concurso_slug", filters.contest);
  if (filters.proof) query = query.eq("prova_id", filters.proof);
  if (filters.year) query = query.eq("ano", filters.year);
  if (filters.status) query = query.eq("classification_status", filters.status);
  if (ids) query = query.in("id", ids);
  const { data, error } = await query.order("ano", { ascending: false }).order("numero").limit(500);
  if (error) throw error;
  return (data as unknown as CatalogRow[]).map(mapQuestion);
}

export async function getNextQuestionId(question: Pick<QuestionCatalogItem, "id" | "proofId" | "number">) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("questao_catalog").select("id")
    .eq("prova_id", question.proofId).gt("numero", question.number).order("numero").limit(1).maybeSingle();
  if (error) throw error;
  if (data?.id) return data.id;
  const { data: first, error: firstError } = await supabase.from("questao_catalog").select("id")
    .eq("prova_id", question.proofId).neq("id", question.id).order("numero").limit(1).maybeSingle();
  if (firstError) throw firstError;
  return first?.id ?? null;
}

export async function listQuestionFilterOptions() {
  if (!isSupabaseConfigured) return { contests: [], disciplines: [], subjects: [], subsubjects: [], boards: [], years: [], proofs: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.from("questao_catalog")
    .select("concurso_slug,concurso_titulo,disciplina_slug,disciplina_nome,assunto_slug,assunto_nome,subassunto_slug,subassunto_nome,banca_slug,banca_nome,ano,prova_id,prova_titulo");
  if (error) throw error;
  const unique = (slugKey: keyof typeof data[number], nameKey: keyof typeof data[number]) =>
    [...new Map(data.flatMap((row) => row[slugKey] && row[nameKey] ? [[String(row[slugKey]), String(row[nameKey])] as const] : [])).entries()]
      .map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return {
    contests: unique("concurso_slug", "concurso_titulo"),
    disciplines: unique("disciplina_slug", "disciplina_nome"),
    subjects: unique("assunto_slug", "assunto_nome"),
    subsubjects: unique("subassunto_slug", "subassunto_nome"),
    boards: unique("banca_slug", "banca_nome"),
    years: [...new Set(data.flatMap((row) => row.ano ? [row.ano] : []))].sort((a, b) => b - a),
    proofs: unique("prova_id", "prova_titulo"),
  };
}

function aggregate(rows: StatisticRow[], kind: "discipline" | "subject"): RankedStatistic[] {
  const totals = new Map<string, RankedStatistic>();
  for (const row of rows) {
    const id = kind === "discipline" ? row.disciplina_id : row.assunto_id;
    const slug = kind === "discipline" ? row.disciplina_slug : row.assunto_slug;
    const label = kind === "discipline" ? row.disciplina_nome : row.assunto_nome;
    if (!id || !slug || !label) continue;
    const current = totals.get(id);
    totals.set(id, { id, slug, label, count: (current?.count ?? 0) + Number(row.question_count), percentage: 0 });
  }
  const sampleSize = [...totals.values()].reduce((sum, item) => sum + item.count, 0);
  return [...totals.values()]
    .map((item) => ({ ...item, percentage: sampleSize ? Number((item.count * 100 / sampleSize).toFixed(2)) : 0 }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "pt-BR"));
}

async function loadInsights(
  scope?: { column: "prova_id" | "banca_slug" | "concurso_slug"; value: string },
  filters: StatisticsFilters = {},
): Promise<QuestionInsights> {
  if (!isSupabaseConfigured) return { proofCount: 0, sampleSize: 0, minimumSampleSize: 20, isSmallSample: true, disciplines: [], subjects: [] };
  const supabase = await createClient();
  let disciplineQuery = supabase.from("estatisticas_prova_disciplinas").select("prova_id,disciplina_id,disciplina_slug,disciplina_nome,question_count,sample_size,is_small_sample,banca_slug,ano,cargo_nome");
  let subjectQuery = supabase.from("estatisticas_prova_assuntos").select("prova_id,disciplina_id,disciplina_slug,disciplina_nome,assunto_id,assunto_slug,assunto_nome,question_count,sample_size,is_small_sample,banca_slug,ano,cargo_nome");
  if (scope) {
    disciplineQuery = disciplineQuery.eq(scope.column, scope.value);
    subjectQuery = subjectQuery.eq(scope.column, scope.value);
  }
  if (filters.board) {
    disciplineQuery = disciplineQuery.eq("banca_slug", filters.board);
    subjectQuery = subjectQuery.eq("banca_slug", filters.board);
  }
  if (filters.year) {
    disciplineQuery = disciplineQuery.eq("ano", filters.year);
    subjectQuery = subjectQuery.eq("ano", filters.year);
  }
  if (filters.role) {
    disciplineQuery = disciplineQuery.eq("cargo_nome", filters.role);
    subjectQuery = subjectQuery.eq("cargo_nome", filters.role);
  }
  if (filters.discipline) {
    disciplineQuery = disciplineQuery.eq("disciplina_slug", filters.discipline);
    subjectQuery = subjectQuery.eq("disciplina_slug", filters.discipline);
  }
  const [disciplineResult, subjectResult] = await Promise.all([disciplineQuery, subjectQuery]);
  if (disciplineResult.error) throw disciplineResult.error;
  if (subjectResult.error) throw subjectResult.error;
  const disciplineRows = disciplineResult.data as unknown as StatisticRow[];
  const subjectRows = subjectResult.data as unknown as StatisticRow[];
  const disciplines = aggregate(disciplineRows, "discipline");
  const subjects = aggregate(subjectRows, "subject");
  const sampleSize = disciplines.reduce((sum, item) => sum + item.count, 0);
  return {
    proofCount: new Set(disciplineRows.map((row) => row.prova_id)).size,
    sampleSize,
    minimumSampleSize: 20,
    isSmallSample: sampleSize < 20,
    disciplines,
    subjects,
  };
}

export function getProofQuestionInsights(proofId: string) {
  return loadInsights({ column: "prova_id", value: proofId });
}

export function getBoardQuestionInsights(boardSlug: string) {
  return loadInsights({ column: "banca_slug", value: boardSlug });
}

export function getContestQuestionInsights(contestSlug: string) {
  return loadInsights({ column: "concurso_slug", value: contestSlug });
}

export function getGlobalQuestionInsights(filters: StatisticsFilters = {}) {
  return loadInsights(undefined, filters);
}

export async function listStatisticsFilterOptions() {
  if (!isSupabaseConfigured) return { boards: [], years: [], roles: [], disciplines: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.from("estatisticas_prova_disciplinas")
    .select("banca_slug,banca_nome,ano,cargo_nome,disciplina_slug,disciplina_nome");
  if (error) throw error;
  return {
    boards: [...new Map(data.flatMap((row) => row.banca_slug && row.banca_nome ? [[row.banca_slug, row.banca_nome] as const] : [])).entries()].map(([slug, name]) => ({ slug, name })),
    years: [...new Set(data.flatMap((row) => row.ano ? [row.ano] : []))].sort((a, b) => b - a),
    roles: [...new Set(data.flatMap((row) => row.cargo_nome ? [row.cargo_nome] : []))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    disciplines: [...new Map(data.map((row) => [row.disciplina_slug, row.disciplina_nome] as const)).entries()].map(([slug, name]) => ({ slug, name })),
  };
}
