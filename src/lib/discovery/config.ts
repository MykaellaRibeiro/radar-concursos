export const DISCOVERY_QUERIES = [
  "concurso público autorizado",
  "concurso comissão formada",
  "concurso banca definida",
  "concurso banca contratada",
  "novo concurso previsto",
  "concurso edital em elaboração",
  "concurso edital iminente",
  "concurso grupo de trabalho",
] as const;

// Historical backfill for institutions that are poorly represented by generic
// "concurso previsto" searches. These queries are intentionally explicit: the
// collector still applies the normal evidence, deduplication and confidence
// rules before persisting anything.
export const BANKING_DISCOVERY_QUERIES = [
  '(site:bb.com.br OR site:caixa.gov.br) concurso público edital publicado',
  '(site:bndes.gov.br OR site:bnb.gov.br) concurso seleção pública edital publicado',
  '(site:bancoamazonia.com.br OR site:brb.com.br) concurso público edital publicado',
  'site:banrisul.com.br concurso público edital publicado',
] as const;

export const HIGH_PRIORITY_DOMAINS = [
  "gov.br", "jus.br", "leg.br", "mp.br", "def.br", "cebraspe.org.br", "fgv.br", "fcc.org.br",
  "vunesp.com.br", "cesgranrio.org.br", "bb.com.br", "caixa.gov.br", "bndes.gov.br", "bnb.gov.br",
  "bancoamazonia.com.br", "brb.com.br", "banrisul.com.br", "folha.qconcursos.com", "estrategiaconcursos.com.br", "blog.grancursosonline.com.br",
  "grancursosonline.com.br", "pciconcursos.com.br", "acheconcursos.com.br", "jcconcursos.com.br",
] as const;

export const OFFICIAL_CONFIRMATION_DOMAINS = [
  "gov.br", "jus.br", "leg.br", "mp.br", "def.br", "bb.com.br", "caixa.gov.br", "bndes.gov.br",
  "bnb.gov.br", "bancoamazonia.com.br", "brb.com.br", "banrisul.com.br",
] as const;
