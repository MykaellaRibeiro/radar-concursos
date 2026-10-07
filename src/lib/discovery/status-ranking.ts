import type { ConcursoStatus } from "@/types/domain";

const statusRanks: Record<ConcursoStatus, number> = {
  SOLICITADO: 10, ANUNCIADO: 20, PREVISTO: 30, AUTORIZADO: 40, COMISSAO_FORMADA: 50,
  BANCA_EM_DEFINICAO: 60, BANCA_DEFINIDA: 70, BANCA_CONTRATADA: 80, EDITAL_EM_ELABORACAO: 90,
  EDITAL_IMINENTE: 100, EDITAL_PUBLICADO: 110, INSCRICOES_ABERTAS: 120, INSCRICOES_ENCERRADAS: 130,
  PROVA_MARCADA: 140, PROVA_REALIZADA: 150, GABARITO_PUBLICADO: 160, RESULTADO_PRELIMINAR: 170,
  RESULTADO_DEFINITIVO: 180, HOMOLOGADO: 190, CONVOCACAO: 200, ENCERRADO: 210,
};

export function statusRank(status: ConcursoStatus) {
  return statusRanks[status];
}

export function shouldAdvanceStatus(current: ConcursoStatus, candidate: ConcursoStatus | null) {
  return candidate !== null && statusRanks[candidate] > statusRanks[current];
}
