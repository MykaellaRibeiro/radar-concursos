import type { ConfidenceLevel, ConcursoStatus } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

const statusLabels: Record<ConcursoStatus, string> = {
  SOLICITADO: "Solicitado", ANUNCIADO: "Anunciado", PREVISTO: "Previsto", AUTORIZADO: "Autorizado",
  COMISSAO_FORMADA: "Comissão formada", BANCA_EM_DEFINICAO: "Banca em definição", BANCA_DEFINIDA: "Banca definida",
  BANCA_CONTRATADA: "Banca contratada", EDITAL_EM_ELABORACAO: "Edital em elaboração", EDITAL_IMINENTE: "Edital iminente",
  EDITAL_PUBLICADO: "Edital publicado", INSCRICOES_ABERTAS: "Inscrições abertas", INSCRICOES_ENCERRADAS: "Inscrições encerradas",
  PROVA_MARCADA: "Prova marcada", PROVA_REALIZADA: "Prova realizada", GABARITO_PUBLICADO: "Gabarito publicado",
  RESULTADO_PRELIMINAR: "Resultado preliminar", RESULTADO_DEFINITIVO: "Resultado definitivo", HOMOLOGADO: "Homologado",
  CONVOCACAO: "Convocação", ENCERRADO: "Encerrado",
};

export function StatusBadge({ status }: { status: ConcursoStatus }) {
  const open = status === "INSCRICOES_ABERTAS" || status === "EDITAL_PUBLICADO";
  const closed = status === "ENCERRADO" || status === "INSCRICOES_ENCERRADAS";
  return <span className={cn("badge", open && "badge--success", closed && "badge--neutral")}>{statusLabels[status]}</span>;
}

const confidenceLabels: Record<ConfidenceLevel, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", OFFICIAL: "Oficial" };

export function ConfidenceBadge({ confidence }: { confidence: ConfidenceLevel }) {
  return <span className={cn("confidence", confidence === "OFFICIAL" && "confidence--official")}>Confiança: {confidenceLabels[confidence]}</span>;
}
