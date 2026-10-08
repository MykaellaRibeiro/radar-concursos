import { createClient } from "@/lib/supabase/server";
import { areDevelopmentMocksEnabled, isSupabaseConfigured } from "@/lib/supabase/config";
import type { AnswerKeyDocument, ConcursoDetail, ConcursoStatus, ConfidenceLevel, CutoffScore, DocumentFile, EditalDocument, ProofDocument, ConcursoSummary, ExtractionStatus } from "@/types/domain";
import { mockConcursos, mockDetail } from "./mock";
import { safeExternalUrl } from "@/lib/utils/external-url";

export interface ConcursoFilters {
  query?: string;
  status?: ConcursoStatus;
  region?: string;
  state?: string;
  city?: string;
  education?: string;
  minimumSalary?: number;
  area?: string;
  board?: string;
  organization?: string;
  confidence?: ConfidenceLevel;
  recentOnly?: boolean;
}

type DbConcurso = {
  id: string; slug: string; titulo: string; status: ConcursoStatus; confidence: ConfidenceLevel;
  uf: string | null; cidade: string | null; vagas_total: number | null; salario_min: number | null;
  salario_max: number | null; escolaridade_resumo: string | null; fim_inscricoes: string | null;
  updated_at: string; descricao?: string | null; regiao?: string | null; data_edital?: string | null;
  inicio_inscricoes?: string | null; data_prova?: string | null; official_url?: string | null;
  vagas_previstas?: number | null; data_prevista?: string | null;
  data_prevista_precision?: "EXACT" | "MONTH" | "QUARTER" | "YEAR" | "UNKNOWN";
  banca_status?: "PROVAVEL" | "DEFINIDA" | "CONTRATADA" | null; banca_observacao?: string | null;
  latest_movement_title?: string | null; latest_movement_date?: string | null; latest_movement_at?: string | null;
  source_count?: number; primary_board?: string | null;
  orgaos: { nome: string; sigla: string | null } | null;
  concursos_bancas?: Array<{ bancas?: { nome?: string } | null }>;
  concursos_cargos?: Array<{ cargos?: { area?: string | null } | null }>;
};

type SearchConcurso = Omit<DbConcurso, "orgaos"> & {
  orgao_nome: string;
  orgao_sigla: string | null;
  areas: string;
  bancas: string;
  search_text: string;
};

function mapSummary(row: DbConcurso): ConcursoSummary {
  return {
    id: row.id, slug: row.slug, titulo: row.titulo, orgao: row.orgaos ?? { nome: row.titulo, sigla: null },
    status: row.status, confidence: row.confidence, uf: row.uf, cidade: row.cidade, vagasTotal: row.vagas_total,
    salarioMin: row.salario_min, salarioMax: row.salario_max, escolaridadeResumo: row.escolaridade_resumo,
    fimInscricoes: row.fim_inscricoes, updatedAt: row.updated_at,
    vagasPrevistas: row.vagas_previstas ?? null, dataPrevista: row.data_prevista ?? null,
    dataPrevistaPrecision: row.data_prevista_precision ?? "UNKNOWN", bancaStatus: row.banca_status ?? null,
    bancaObservacao: row.banca_observacao ?? null, latestMovementTitle: row.latest_movement_title ?? null,
    latestMovementDate: row.latest_movement_date ?? null, latestMovementAt: row.latest_movement_at ?? null,
    sourceCount: row.source_count ?? 0, primaryBoard: row.primary_board ?? null,
  };
}

type DbStoredFile = {
  id: string; tipo: string; titulo: string | null; source_url: string | null; storage_bucket: string | null;
  storage_path: string | null; extraction_status: ExtractionStatus | null; sha256: string | null; published_at: string | null;
  fontes?: { nome?: string | null } | null;
};

function publicStorageUrl(bucket?: string | null, path?: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !bucket || !path) return null;
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${safePath}`;
}

function mapStoredFile(file: DbStoredFile | null | undefined, fallback: { id: string; kind: string; title: string; publishedAt?: string | null; sourceUrl?: string | null }): DocumentFile {
  return {
    id: file?.id ?? fallback.id,
    kind: file?.tipo ?? fallback.kind,
    title: file?.titulo ?? fallback.title,
    publishedAt: file?.published_at ?? fallback.publishedAt ?? null,
    sourceUrl: safeExternalUrl(file?.source_url ?? fallback.sourceUrl),
    storageUrl: publicStorageUrl(file?.storage_bucket, file?.storage_path),
    sourceName: file?.fontes?.nome ?? null,
    extractionStatus: file?.extraction_status ?? null,
    sha256: file?.sha256 ?? null,
  };
}

export async function listConcursos(statuses?: ConcursoStatus[], filters?: ConcursoFilters, page = 1) {
  if (!isSupabaseConfigured) return areDevelopmentMocksEnabled ? mockConcursos.filter((item) => {
    if (statuses && !statuses.includes(item.status)) return false;
    if (filters?.status && item.status !== filters.status) return false;
    if (filters?.state && item.uf !== filters.state) return false;
    if (filters?.city && !item.cidade?.toLowerCase().includes(filters.city.toLowerCase())) return false;
    if (filters?.education && !item.escolaridadeResumo?.toLowerCase().includes(filters.education.toLowerCase())) return false;
    if (filters?.minimumSalary && (item.salarioMax ?? 0) < filters.minimumSalary) return false;
    if (filters?.area || filters?.board) return false;
    if (filters?.organization && !item.orgao.nome.toLowerCase().includes(filters.organization.toLowerCase())) return false;
    if (filters?.confidence && item.confidence !== filters.confidence) return false;
    if (filters?.recentOnly && Date.parse(item.latestMovementDate ?? item.updatedAt) < Date.now() - 7 * 86_400_000) return false;
    if (filters?.query) {
      const haystack = `${item.titulo} ${item.orgao.nome} ${item.orgao.sigla ?? ""} ${item.cidade ?? ""}`.toLowerCase();
      if (!haystack.includes(filters.query.toLowerCase())) return false;
    }
    return true;
  }) : [];
  const supabase = await createClient();
  let query = supabase.from("concurso_search").select("id, slug, titulo, status, confidence, uf, cidade, regiao, vagas_total, salario_min, salario_max, escolaridade_resumo, fim_inscricoes, created_at, updated_at, orgao_nome, orgao_sigla, areas, bancas, search_text, vagas_previstas, data_prevista, data_prevista_precision, banca_status, banca_observacao, latest_movement_title, latest_movement_date, latest_movement_at, source_count, primary_board").order("updated_at", { ascending: false });
  if (statuses?.length) query = query.in("status", statuses);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.state) query = query.eq("uf", filters.state);
  if (filters?.region) query = query.eq("regiao", filters.region);
  if (filters?.city) query = query.ilike("cidade", `%${filters.city}%`);
  if (filters?.education) query = query.ilike("escolaridade_resumo", `%${filters.education}%`);
  if (filters?.minimumSalary) query = query.gte("salario_max", filters.minimumSalary);
  if (filters?.query) query = query.ilike("search_text", `%${filters.query}%`);
  if (filters?.area) query = query.ilike("areas", `%${filters.area}%`);
  if (filters?.board) query = query.ilike("bancas", `%${filters.board}%`);
  if (filters?.organization) query = query.ilike("orgao_nome", `%${filters.organization}%`);
  if (filters?.confidence) query = query.eq("confidence", filters.confidence);
  if (filters?.recentOnly) query = query.gte("latest_movement_date", new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10));
  const safePage = Math.max(1, Math.trunc(page));
  const pageSize = 50;
  const from = (safePage - 1) * pageSize;
  const { data, error } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  return (data as unknown as SearchConcurso[]).map((row) => mapSummary({ ...row, orgaos: { nome: row.orgao_nome, sigla: row.orgao_sigla } }));
}

export async function getConcurso(slug: string): Promise<ConcursoDetail | null> {
  if (!isSupabaseConfigured) return areDevelopmentMocksEnabled ? { ...mockDetail, slug } : null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("concursos").select("id, slug, titulo, status, confidence, uf, cidade, regiao, descricao, vagas_total, vagas_previstas, salario_min, salario_max, escolaridade_resumo, data_prevista, data_prevista_precision, banca_status, banca_observacao, data_edital, inicio_inscricoes, fim_inscricoes, data_prova, official_url, updated_at, orgaos(nome, sigla), concursos_bancas(bancas(nome)), movimentacoes(id, titulo, descricao, event_date, occurred_at, confidence, movimentacao_fontes(fontes(nome,tipo,ranking_tier), titulo, url, published_at, confidence)), concursos_cargos(id, vagas, salario_inicial, cargos(nome)), editais(id,tipo,numero,ano,titulo,published_at,source_url,url_original,arquivos(id,tipo,titulo,source_url,storage_bucket,storage_path,extraction_status,sha256,published_at,fontes(nome))), provas(id,ano,titulo,turno,tipo,quantidade_questoes,published_at,source_url,url_original,bancas(nome),cargos(nome),arquivos(id,tipo,titulo,source_url,storage_bucket,storage_path,extraction_status,sha256,published_at,fontes(nome)),gabaritos(id,tipo,titulo,published_at,source_url,url_original,arquivos(id,tipo,titulo,source_url,storage_bucket,storage_path,extraction_status,sha256,published_at,fontes(nome)))), notas_corte(id,modalidade,nota,classificacao,ano,source_url,published_at,confidence,cargos(nome),fontes(nome)), arquivos(id,tipo,titulo,source_url,storage_bucket,storage_path,extraction_status,sha256,published_at,fontes(nome))").eq("slug", slug).single();
  if (error?.code === "PGRST116") return null;
  if (error) throw error;
  const row = data as unknown as DbConcurso & Record<string, unknown>;
  const movementRows = (row.movimentacoes ?? []) as Array<Record<string, unknown>>;
  const roleRows = (row.concursos_cargos ?? []) as Array<Record<string, unknown>>;
  const boardRows = (row.concursos_bancas ?? []) as Array<{ bancas?: { nome?: string } | null }>;
  const editalRows = (row.editais ?? []) as Array<Record<string, unknown>>;
  const proofRows = (row.provas ?? []) as Array<Record<string, unknown>>;
  const fileRows = (row.arquivos ?? []) as DbStoredFile[];
  const cutoffRows = (row.notas_corte ?? []) as Array<Record<string, unknown>>;
  const editais: EditalDocument[] = editalRows.map((item) => {
    const file = item.arquivos as DbStoredFile | null;
    return {
      ...mapStoredFile(file, { id: String(item.id), kind: "EDITAL", title: String(item.titulo), publishedAt: item.published_at as string | null, sourceUrl: (item.source_url ?? item.url_original) as string | null }),
      type: item.tipo as string | null,
      number: item.numero as string | null,
      year: item.ano as number | null,
    };
  }).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const provas: ProofDocument[] = proofRows.map((item) => {
    const file = item.arquivos as DbStoredFile | null;
    const answerKeys: AnswerKeyDocument[] = ((item.gabaritos ?? []) as Array<Record<string, unknown>>).map((answer) => ({
      ...mapStoredFile(answer.arquivos as DbStoredFile | null, { id: String(answer.id), kind: "GABARITO", title: String(answer.titulo), publishedAt: answer.published_at as string | null, sourceUrl: (answer.source_url ?? answer.url_original) as string | null }),
      type: String(answer.tipo),
    }));
    return {
      ...mapStoredFile(file, { id: String(item.id), kind: "PROVA", title: String(item.titulo), publishedAt: item.published_at as string | null, sourceUrl: (item.source_url ?? item.url_original) as string | null }),
      contestId: String(row.id), year: item.ano as number | null,
      board: (item.bancas as { nome?: string } | null)?.nome ?? null,
      role: (item.cargos as { nome?: string } | null)?.nome ?? null,
      shift: item.turno as string | null, type: item.tipo as string | null,
      questionCount: item.quantidade_questoes as number | null, answerKeys,
    };
  }).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const documentos = fileRows.filter((file) => !["EDITAL", "RETIFICACAO", "PROVA", "GABARITO"].includes(file.tipo)).map((file) => mapStoredFile(file, { id: file.id, kind: file.tipo, title: file.titulo ?? "Documento" }));
  const notasCorte: CutoffScore[] = cutoffRows.map((cutoff) => ({
    id: String(cutoff.id),
    modality: String(cutoff.modalidade),
    score: Number(cutoff.nota),
    classification: cutoff.classificacao === null ? null : Number(cutoff.classificacao),
    year: cutoff.ano === null ? null : Number(cutoff.ano),
    role: (cutoff.cargos as { nome?: string } | null)?.nome ?? null,
    sourceUrl: safeExternalUrl(cutoff.source_url as string | null),
    sourceName: (cutoff.fontes as { nome?: string } | null)?.nome ?? null,
    publishedAt: cutoff.published_at as string | null,
    confidence: cutoff.confidence as ConfidenceLevel,
  })).sort((left, right) => (right.year ?? 0) - (left.year ?? 0) || right.score - left.score);
  return {
    ...mapSummary(row), descricao: row.descricao ?? null, regiao: row.regiao ?? null, dataEdital: row.data_edital ?? null,
    inicioInscricoes: row.inicio_inscricoes ?? null, dataProva: row.data_prova ?? null, officialUrl: safeExternalUrl(row.official_url),
    banca: boardRows[0]?.bancas?.nome ?? row.banca_observacao ?? null,
    movimentos: movementRows.map((item) => {
      const links = (item.movimentacao_fontes ?? []) as Array<{ url?: string; titulo?: string | null; published_at?: string | null; confidence?: ConfidenceLevel; fontes?: { nome?: string; tipo?: string; ranking_tier?: string | null } | null }>;
      const sources = links.flatMap((link) => {
        const url = safeExternalUrl(link.url);
        return url ? [{ name: link.fontes?.nome ?? new URL(url).hostname, type: link.fontes?.tipo ?? "OTHER", rankingTier: link.fontes?.ranking_tier ?? null, title: link.titulo ?? null, url, publishedAt: link.published_at ?? null, confidence: link.confidence ?? item.confidence as ConfidenceLevel }] : [];
      });
      return { id: String(item.id), titulo: String(item.titulo), descricao: item.descricao ? String(item.descricao) : null, eventDate: String(item.event_date), occurredAt: item.occurred_at ? String(item.occurred_at) : null, confidence: item.confidence as ConfidenceLevel, sourceName: sources[0]?.name ?? null, sourceUrl: sources[0]?.url ?? null, sources };
    }),
    cargos: roleRows.map((item) => ({ id: String(item.id), nome: String((item.cargos as { nome?: string })?.nome ?? "Cargo"), vagas: item.vagas as number | null, salarioInicial: item.salario_inicial as number | null })),
    editais, provas, notasCorte, documentos,
  };
}

export type PredictedSort = "movement" | "advanced" | "recent" | "state" | "organization" | "confidence" | "sources";

export async function listPredictedConcursos(filters?: ConcursoFilters, sort: PredictedSort = "movement") {
  const needsLocalTextFilter = filters?.board || filters?.organization;
  const queryFilters = needsLocalTextFilter
    ? { ...filters, board: undefined, organization: undefined }
    : filters;
  const items = await listConcursos(["SOLICITADO", "ANUNCIADO", "PREVISTO", "AUTORIZADO", "COMISSAO_FORMADA", "BANCA_EM_DEFINICAO", "BANCA_DEFINIDA", "BANCA_CONTRATADA", "EDITAL_EM_ELABORACAO", "EDITAL_IMINENTE"], queryFilters);
  const confidence = { OFFICIAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
  const status = { SOLICITADO: 10, ANUNCIADO: 20, PREVISTO: 30, AUTORIZADO: 40, COMISSAO_FORMADA: 50, BANCA_EM_DEFINICAO: 60, BANCA_DEFINIDA: 70, BANCA_CONTRATADA: 80, EDITAL_EM_ELABORACAO: 90, EDITAL_IMINENTE: 100 } as const;
  const filtered = items.filter((item) => {
    if (filters?.board && !`${item.primaryBoard ?? ""} ${item.bancaObservacao ?? ""}`.toLocaleLowerCase("pt-BR").includes(filters.board.toLocaleLowerCase("pt-BR"))) return false;
    if (filters?.organization && !`${item.orgao.nome} ${item.orgao.sigla ?? ""}`.toLocaleLowerCase("pt-BR").includes(filters.organization.toLocaleLowerCase("pt-BR"))) return false;
    return true;
  });
  return [...filtered].sort((a, b) => {
    if (sort === "confidence") return confidence[b.confidence] - confidence[a.confidence] || b.updatedAt.localeCompare(a.updatedAt);
    if (sort === "sources") return (b.sourceCount ?? 0) - (a.sourceCount ?? 0) || b.updatedAt.localeCompare(a.updatedAt);
    if (sort === "advanced") return status[b.status as keyof typeof status] - status[a.status as keyof typeof status] || (b.latestMovementAt ?? b.updatedAt).localeCompare(a.latestMovementAt ?? a.updatedAt);
    if (sort === "recent") return b.updatedAt.localeCompare(a.updatedAt);
    if (sort === "state") return (a.uf ?? "ZZ").localeCompare(b.uf ?? "ZZ", "pt-BR") || a.titulo.localeCompare(b.titulo, "pt-BR");
    if (sort === "organization") return a.orgao.nome.localeCompare(b.orgao.nome, "pt-BR") || a.titulo.localeCompare(b.titulo, "pt-BR");
    return (b.latestMovementAt ?? b.latestMovementDate ?? b.updatedAt).localeCompare(a.latestMovementAt ?? a.latestMovementDate ?? a.updatedAt);
  });
}

export async function getDashboardStats() {
  if (!isSupabaseConfigured) {
    const items = areDevelopmentMocksEnabled ? mockConcursos : [];
    return {
      followed: items.length,
      newCompetitions: items.length,
      publishedNotices: items.filter((item) => item.status === "EDITAL_PUBLICADO").length,
      endingSoon: items.filter((item) => item.fimInscricoes && new Date(item.fimInscricoes) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length,
    };
  }
  const supabase = await createClient();
  const newWindowHours = Number(process.env.NEW_CONTEST_WINDOW_HOURS ?? 24);
  const newSince = new Date(Date.now() - newWindowHours * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [followed, recent, notices, endingSoon] = await Promise.all([
    supabase.from("concursos_seguidos").select("id", { count: "exact", head: true }),
    supabase.from("concursos").select("id", { count: "exact", head: true }).gte("created_at", newSince),
    supabase.from("editais").select("id", { count: "exact", head: true }).gte("published_at", newSince),
    supabase.from("concursos").select("id", { count: "exact", head: true }).eq("status", "INSCRICOES_ABERTAS").gte("fim_inscricoes", today).lte("fim_inscricoes", deadline),
  ]);
  return {
    followed: followed.error ? null : followed.count,
    newCompetitions: recent.error ? null : recent.count,
    publishedNotices: notices.error ? null : notices.count,
    endingSoon: endingSoon.error ? null : endingSoon.count,
  };
}

export async function listFollowedConcursos(limit = 4) {
  if (!isSupabaseConfigured) return areDevelopmentMocksEnabled ? mockConcursos.slice(0, 4) : [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("concursos_seguidos").select("concursos(id, slug, titulo, status, confidence, uf, cidade, vagas_total, salario_min, salario_max, escolaridade_resumo, fim_inscricoes, updated_at, orgaos(nome, sigla))").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data as unknown as Array<{ concursos: DbConcurso | null }>).flatMap((row) => row.concursos ? [mapSummary(row.concursos)] : []);
}

export interface RecentMovement {
  id: string;
  title: string;
  competitionTitle: string;
  competitionSlug: string;
  organization: string;
  eventDate: string;
  statusNew: ConcursoStatus | null;
  isMock?: boolean;
}

export async function listRecentMovements(): Promise<RecentMovement[]> {
  if (!isSupabaseConfigured) return areDevelopmentMocksEnabled ? mockConcursos.map((item) => ({
    id: `movement-${item.id}`, title: "Atualização demonstrativa", competitionTitle: item.titulo,
    competitionSlug: item.slug, organization: item.orgao.sigla ?? item.orgao.nome, eventDate: item.updatedAt,
    statusNew: item.status, isMock: true,
  })) : [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("movimentacoes").select("id, titulo, event_date, status_novo, concursos(slug, titulo, orgaos(nome, sigla))").order("event_date", { ascending: false }).limit(5);
  if (error) throw error;
  return (data as unknown as Array<{ id: string; titulo: string; event_date: string; status_novo: ConcursoStatus | null; concursos: { slug: string; titulo: string; orgaos: { nome: string; sigla: string | null } | null } }>).map((row) => ({
    id: row.id, title: row.titulo, competitionTitle: row.concursos.titulo, competitionSlug: row.concursos.slug,
    organization: row.concursos.orgaos?.sigla ?? row.concursos.orgaos?.nome ?? row.concursos.titulo,
    eventDate: row.event_date, statusNew: row.status_novo,
  }));
}

export async function listRecentPredictedMovements(): Promise<RecentMovement[]> {
  const predictedStatuses: ConcursoStatus[] = ["SOLICITADO", "ANUNCIADO", "PREVISTO", "AUTORIZADO", "COMISSAO_FORMADA", "BANCA_EM_DEFINICAO", "BANCA_DEFINIDA", "BANCA_CONTRATADA", "EDITAL_EM_ELABORACAO", "EDITAL_IMINENTE"];
  if (!isSupabaseConfigured) return (await listRecentMovements()).filter((item) => item.statusNew && predictedStatuses.includes(item.statusNew)).slice(0, 3);
  const supabase = await createClient();
  const { data, error } = await supabase.from("movimentacoes").select("id, titulo, event_date, status_novo, concursos(slug, titulo, orgaos(nome, sigla))").in("status_novo", predictedStatuses).order("event_date", { ascending: false }).limit(3);
  if (error) throw error;
  return (data as unknown as Array<{ id: string; titulo: string; event_date: string; status_novo: ConcursoStatus | null; concursos: { slug: string; titulo: string; orgaos: { nome: string; sigla: string | null } | null } }>).map((row) => ({
    id: row.id, title: row.titulo, competitionTitle: row.concursos.titulo, competitionSlug: row.concursos.slug,
    organization: row.concursos.orgaos?.sigla ?? row.concursos.orgaos?.nome ?? row.concursos.titulo,
    eventDate: row.event_date, statusNew: row.status_novo,
  }));
}
