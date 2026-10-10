import type { SearchProvider, SearchResult } from "../search/types";

export interface DocumentDiscoverySubject {
  organization: string;
  state: string | null;
  board: string | null;
  role: string | null;
  year: number | null;
}

export class DocumentSearchProvider {
  constructor(private readonly searchProvider: SearchProvider) {}

  async discover(subject: DocumentDiscoverySubject): Promise<SearchResult[]> {
    const context = [subject.organization, subject.state, subject.role, subject.board, subject.year].filter(Boolean).join(" ");
    const queries = [
      `"${subject.organization}" (edital OR retificação) concurso filetype:pdf`,
      `${context} (prova OR "caderno de questões" OR gabarito) concurso filetype:pdf`,
      `${context} ("resultado final" OR classificação) concurso filetype:pdf`,
      `${context} (concorrência OR demanda OR "candidatos por vaga") concurso filetype:pdf`,
    ];
    const batches = await Promise.all(queries.map((query) => this.searchProvider.search(query, {
      limit: 10,
      objective: "Localizar PDFs de concurso verificáveis, preferindo órgão oficial, banca e Diário Oficial. Não inferir que uma URL pertence ao certame sem evidência de órgão, ano e documento.",
    })));
    return [...new Map(batches.flat().map((result) => [result.url, result])).values()];
  }
}
