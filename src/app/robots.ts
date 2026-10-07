import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/concursos", "/concursos/abertos", "/concursos/previstos", "/provas", "/bancas", "/estatisticas"],
      disallow: ["/api/", "/auth/", "/dashboard", "/meus-concursos", "/alertas", "/configuracoes", "/estudar", "/questoes/salvas"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
