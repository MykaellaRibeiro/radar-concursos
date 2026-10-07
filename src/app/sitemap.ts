import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/concursos`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/concursos/abertos`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/concursos/previstos`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/provas`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/bancas`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/estatisticas`, changeFrequency: "weekly", priority: 0.7 },
  ];
  if (!isSupabaseConfigured) return staticEntries;
  const supabase = await createClient();
  const { data, error } = await supabase.from("concursos").select("slug,updated_at").order("updated_at", { ascending: false }).limit(1000);
  if (error) return staticEntries;
  return [...staticEntries, ...data.map((item) => ({
    url: `${base}/concursos/${encodeURIComponent(item.slug)}`,
    lastModified: item.updated_at,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }))];
}
