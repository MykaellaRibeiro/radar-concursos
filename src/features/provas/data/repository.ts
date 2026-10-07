import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { AnswerKeyDocument, ExtractionStatus, ProofDocument } from "@/types/domain";

export interface ProofFilters {
  query?: string;
  board?: string;
  year?: number;
  organization?: string;
  role?: string;
  state?: string;
  page?: number;
}

type CatalogRow = {
  id: string; concurso_id: string; concurso_slug: string; concurso_titulo: string; orgao_nome: string; orgao_slug: string;
  uf: string | null; ano: number | null; titulo: string; turno: string | null; tipo: string | null; quantidade_questoes: number | null;
  published_at: string | null; banca_nome: string | null; banca_slug: string | null; cargo_nome: string | null;
  storage_bucket: string | null; storage_path: string | null; source_url: string | null; sha256: string | null;
  extraction_status: ExtractionStatus | null; gabarito_id: string | null; gabarito_tipo: string | null; gabarito_titulo: string | null;
  gabarito_storage_bucket: string | null; gabarito_storage_path: string | null; gabarito_source_url: string | null;
};

function publicStorageUrl(bucket?: string | null, path?: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !bucket || !path) return null;
  return `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function mapCatalogRow(row: CatalogRow): ProofDocument {
  const answerKeys: AnswerKeyDocument[] = row.gabarito_id ? [{
    id: row.gabarito_id, kind: "GABARITO", type: row.gabarito_tipo ?? "OUTRO",
    title: row.gabarito_titulo ?? "Gabarito", publishedAt: null, sourceUrl: row.gabarito_source_url,
    storageUrl: publicStorageUrl(row.gabarito_storage_bucket, row.gabarito_storage_path), sourceName: null,
    extractionStatus: null, sha256: null,
  }] : [];
  return {
    id: row.id, kind: "PROVA", title: row.titulo, publishedAt: row.published_at, sourceUrl: row.source_url,
    storageUrl: publicStorageUrl(row.storage_bucket, row.storage_path), sourceName: null,
    extractionStatus: row.extraction_status, sha256: row.sha256, contestId: row.concurso_id,
    contestSlug: row.concurso_slug, contestTitle: row.concurso_titulo, organization: row.orgao_nome, state: row.uf,
    year: row.ano, board: row.banca_nome, boardSlug: row.banca_slug, role: row.cargo_nome, shift: row.turno,
    type: row.tipo, questionCount: row.quantidade_questoes, answerKeys,
  };
}

export async function listProofs(filters: ProofFilters = {}) {
  const pageSize = 20;
  const page = Math.max(filters.page ?? 1, 1);
  if (!isSupabaseConfigured) return { items: [] as ProofDocument[], page, pageSize, total: 0, totalPages: 0 };
  const supabase = await createClient();
  let query = supabase.from("prova_catalog").select("id,concurso_id,concurso_slug,concurso_titulo,orgao_nome,orgao_slug,uf,ano,titulo,turno,tipo,quantidade_questoes,published_at,banca_nome,banca_slug,cargo_nome,storage_bucket,storage_path,source_url,sha256,extraction_status,gabarito_id,gabarito_tipo,gabarito_titulo,gabarito_storage_bucket,gabarito_storage_path,gabarito_source_url", { count: "exact" });
  if (filters.query) query = query.ilike("search_text", `%${filters.query}%`);
  if (filters.board) query = query.eq("banca_slug", filters.board);
  if (filters.year) query = query.eq("ano", filters.year);
  if (filters.organization) query = query.eq("orgao_slug", filters.organization);
  if (filters.role) query = query.ilike("cargo_nome", `%${filters.role}%`);
  if (filters.state) query = query.eq("uf", filters.state);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.order("ano", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  const total = count ?? 0;
  return { items: (data as CatalogRow[]).map(mapCatalogRow), page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

export async function listProofFilterOptions() {
  if (!isSupabaseConfigured) return { boards: [], years: [], organizations: [], roles: [], states: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.from("prova_catalog").select("banca_nome,banca_slug,ano,orgao_nome,orgao_slug,cargo_nome,uf").limit(500);
  if (error) throw error;
  const rows = data as Array<Pick<CatalogRow, "banca_nome" | "banca_slug" | "ano" | "orgao_nome" | "orgao_slug" | "cargo_nome" | "uf">>;
  return {
    boards: [...new Map(rows.flatMap((row) => row.banca_slug && row.banca_nome ? [[row.banca_slug, row.banca_nome] as const] : [])).entries()].map(([slug, name]) => ({ slug, name })),
    years: [...new Set(rows.flatMap((row) => row.ano ? [row.ano] : []))].sort((a, b) => b - a),
    organizations: [...new Map(rows.map((row) => [row.orgao_slug, row.orgao_nome] as const)).entries()].map(([slug, name]) => ({ slug, name })),
    roles: [...new Set(rows.flatMap((row) => row.cargo_nome ? [row.cargo_nome] : []))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    states: [...new Set(rows.flatMap((row) => row.uf ? [row.uf] : []))].sort(),
  };
}

export async function getProof(id: string): Promise<ProofDocument | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("prova_catalog").select("id,concurso_id,concurso_slug,concurso_titulo,orgao_nome,orgao_slug,uf,ano,titulo,turno,tipo,quantidade_questoes,published_at,banca_nome,banca_slug,cargo_nome,storage_bucket,storage_path,source_url,sha256,extraction_status,gabarito_id,gabarito_tipo,gabarito_titulo,gabarito_storage_bucket,gabarito_storage_path,gabarito_source_url").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapCatalogRow(data as CatalogRow) : null;
}
