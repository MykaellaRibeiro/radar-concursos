import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface BoardCatalogItem {
  id: string;
  name: string;
  acronym: string | null;
  slug: string;
  site: string | null;
  proofCount: number;
  contestCount: number;
  years: number[];
}

export async function listBoards(): Promise<BoardCatalogItem[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("banca_catalog").select("id,nome,sigla,slug,site,provas_armazenadas,concursos_relacionados,anos_disponiveis").order("nome");
  if (error) throw error;
  return data.map((row) => ({
    id: row.id, name: row.nome, acronym: row.sigla, slug: row.slug, site: row.site,
    proofCount: Number(row.provas_armazenadas), contestCount: Number(row.concursos_relacionados), years: row.anos_disponiveis ?? [],
  }));
}

export async function getBoard(slug: string): Promise<BoardCatalogItem | null> {
  return (await listBoards()).find((board) => board.slug === slug) ?? null;
}
