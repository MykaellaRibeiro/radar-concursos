export const concursoStatuses = [
  "SOLICITADO", "ANUNCIADO", "PREVISTO", "AUTORIZADO", "COMISSAO_FORMADA",
  "BANCA_EM_DEFINICAO", "BANCA_DEFINIDA", "BANCA_CONTRATADA", "EDITAL_EM_ELABORACAO",
  "EDITAL_IMINENTE", "EDITAL_PUBLICADO", "INSCRICOES_ABERTAS", "INSCRICOES_ENCERRADAS",
  "PROVA_MARCADA", "PROVA_REALIZADA", "GABARITO_PUBLICADO", "RESULTADO_PRELIMINAR",
  "RESULTADO_DEFINITIVO", "HOMOLOGADO", "CONVOCACAO", "ENCERRADO",
] as const;

export type ConcursoStatus = (typeof concursoStatuses)[number];
export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH" | "OFFICIAL";

export interface ConcursoSummary {
  id: string;
  slug: string;
  titulo: string;
  orgao: { nome: string; sigla: string | null };
  status: ConcursoStatus;
  confidence: ConfidenceLevel;
  uf: string | null;
  cidade: string | null;
  vagasTotal: number | null;
  salarioMin: number | null;
  salarioMax: number | null;
  escolaridadeResumo: string | null;
  fimInscricoes: string | null;
  updatedAt: string;
  vagasPrevistas?: number | null;
  dataPrevista?: string | null;
  dataPrevistaPrecision?: "EXACT" | "MONTH" | "QUARTER" | "YEAR" | "UNKNOWN";
  bancaStatus?: "PROVAVEL" | "DEFINIDA" | "CONTRATADA" | null;
  bancaObservacao?: string | null;
  latestMovementTitle?: string | null;
  latestMovementDate?: string | null;
  latestMovementAt?: string | null;
  sourceCount?: number;
  primaryBoard?: string | null;
  isMock?: boolean;
}

export interface MovementSource {
  name: string;
  type: string;
  rankingTier: string | null;
  title: string | null;
  url: string;
  publishedAt: string | null;
  confidence: ConfidenceLevel;
}

export interface Movimento {
  id: string;
  titulo: string;
  descricao: string | null;
  eventDate: string;
  confidence: ConfidenceLevel;
  sourceName: string | null;
  sourceUrl: string | null;
  occurredAt: string | null;
  sources: MovementSource[];
}

export interface ConcursoDetail extends ConcursoSummary {
  descricao: string | null;
  regiao: string | null;
  dataEdital: string | null;
  inicioInscricoes: string | null;
  dataProva: string | null;
  officialUrl: string | null;
  banca: string | null;
  movimentos: Movimento[];
  cargos: Array<{ id: string; nome: string; vagas: number | null; salarioInicial: number | null }>;
  editais: EditalDocument[];
  provas: ProofDocument[];
  documentos: DocumentFile[];
}

export type ExtractionStatus = "PENDING" | "TEXT" | "PARTIAL" | "SCANNED" | "FAILED" | "NOT_APPLICABLE";

export interface DocumentFile {
  id: string;
  kind: string;
  title: string;
  publishedAt: string | null;
  sourceUrl: string | null;
  storageUrl: string | null;
  sourceName: string | null;
  extractionStatus: ExtractionStatus | null;
  sha256: string | null;
}

export interface EditalDocument extends DocumentFile {
  type: string | null;
  number: string | null;
  year: number | null;
}

export interface AnswerKeyDocument extends DocumentFile {
  type: string;
}

export interface ProofDocument extends DocumentFile {
  contestId: string;
  contestSlug?: string;
  contestTitle?: string;
  organization?: string;
  state?: string | null;
  year: number | null;
  board: string | null;
  boardSlug?: string | null;
  role: string | null;
  shift: string | null;
  type: string | null;
  questionCount: number | null;
  answerKeys: AnswerKeyDocument[];
}
