import type { ConcursoDetail, ConcursoSummary } from "@/types/domain";

export const mockConcursos: ConcursoSummary[] = [
  {
    id: "mock-1", slug: "policia-civil-maranhao", titulo: "Polícia Civil do Maranhão", orgao: { nome: "Polícia Civil do Maranhão", sigla: "PC-MA" },
    status: "BANCA_DEFINIDA", confidence: "HIGH", uf: "MA", cidade: null, vagasTotal: null, salarioMin: null, salarioMax: null,
    escolaridadeResumo: "Não informado", fimInscricoes: null, updatedAt: "2026-10-04", isMock: true,
  },
  {
    id: "mock-2", slug: "tribunal-regional-federal-5", titulo: "Tribunal Regional Federal da 5ª Região", orgao: { nome: "Tribunal Regional Federal da 5ª Região", sigla: "TRF-5" },
    status: "AUTORIZADO", confidence: "OFFICIAL", uf: "PE", cidade: "Recife", vagasTotal: null, salarioMin: null, salarioMax: null,
    escolaridadeResumo: "Superior", fimInscricoes: null, updatedAt: "2026-10-03", isMock: true,
  },
  {
    id: "mock-3", slug: "universidade-federal-ceara", titulo: "Universidade Federal do Ceará", orgao: { nome: "Universidade Federal do Ceará", sigla: "UFC" },
    status: "INSCRICOES_ABERTAS", confidence: "OFFICIAL", uf: "CE", cidade: "Fortaleza", vagasTotal: 12, salarioMin: null, salarioMax: null,
    escolaridadeResumo: "Médio e superior", fimInscricoes: "2026-10-16", updatedAt: "2026-10-02", isMock: true,
  },
  {
    id: "mock-4", slug: "secretaria-fazenda-piaui", titulo: "Secretaria da Fazenda do Piauí", orgao: { nome: "Secretaria da Fazenda do Piauí", sigla: "SEFAZ-PI" },
    status: "EDITAL_EM_ELABORACAO", confidence: "HIGH", uf: "PI", cidade: "Teresina", vagasTotal: null, salarioMin: null, salarioMax: null,
    escolaridadeResumo: "Superior", fimInscricoes: null, updatedAt: "2026-10-01", isMock: true,
  },
];

export const mockDetail: ConcursoDetail = {
  ...mockConcursos[0],
  descricao: "Amostra de desenvolvimento para validar a experiência. Nenhuma informação desta ficha deve ser considerada dado real.",
  regiao: "Nordeste", dataEdital: null, inicioInscricoes: null, dataProva: null, officialUrl: null, banca: "Não informado",
  movimentos: [
    { id: "m3", titulo: "Banca definida", descricao: "Registro demonstrativo da progressão de status.", eventDate: "2026-10-04", occurredAt: null, confidence: "HIGH", sourceName: null, sourceUrl: null, sources: [] },
    { id: "m2", titulo: "Comissão formada", descricao: "Registro demonstrativo para a timeline.", eventDate: "2026-09-12", occurredAt: null, confidence: "MEDIUM", sourceName: null, sourceUrl: null, sources: [] },
    { id: "m1", titulo: "Concurso solicitado", descricao: "Início do histórico demonstrativo.", eventDate: "2026-08-20", occurredAt: null, confidence: "LOW", sourceName: null, sourceUrl: null, sources: [] },
  ],
  cargos: [], editais: [], provas: [], notasCorte: [], documentos: [],
};
