import type { ConfidenceLevel, ConcursoStatus } from "@/types/domain";
import type { SearchResult } from "@/lib/providers/search/types";

export const discoveryEventTypes = [
  "CONCURSO_SOLICITADO", "CONCURSO_ANUNCIADO", "CONCURSO_PREVISTO", "CONCURSO_AUTORIZADO",
  "GRUPO_TRABALHO", "COMISSAO_FORMADA", "BANCA_EM_DEFINICAO", "BANCA_DEFINIDA",
  "BANCA_CONTRATADA", "PROJETO_BASICO", "EDITAL_EM_ELABORACAO", "EDITAL_IMINENTE",
  "EDITAL_PUBLICADO", "RETIFICACAO", "VAGAS_ALTERADAS", "SALARIO_ALTERADO",
  "INSCRICOES_ABERTAS", "INSCRICOES_PRORROGADAS", "INSCRICOES_ENCERRADAS",
  "DATA_PROVA_ALTERADA", "LOCAL_PROVA", "PROVA_REALIZADA", "GABARITO_PUBLICADO",
  "RESULTADO_PRELIMINAR", "RESULTADO_DEFINITIVO", "HOMOLOGACAO", "CONVOCACAO", "NOMEACAO",
] as const;

export type DiscoveryEventType = (typeof discoveryEventTypes)[number];
export type SourceTier = "OFFICIAL" | "EXAM_BOARD" | "SPECIALIZED_HIGH" | "SPECIALIZED" | "NEWS" | "OTHER";

export interface ExtractedDiscovery {
  result: SearchResult;
  eventType: DiscoveryEventType | null;
  status: ConcursoStatus | null;
  sourceTier: SourceTier;
  confidence: ConfidenceLevel;
  orgaoId: string | null;
  orgaoName: string | null;
  orgaoLegalName: string | null;
  orgaoAcronym: string | null;
  organizationMatchScore: number;
  matchedExistingOrganization: boolean;
  uf: string | null;
  city: string | null;
  vacancies: number | null;
  boardName: string | null;
  eventDate: string;
  rejectionReason: "irrelevant" | "missing_contest_context" | "missing_event_date" | "old_content" | "duplicate" | "ambiguous" | "insufficient_evidence" | "unsupported_event" | null;
}
