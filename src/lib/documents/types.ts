export type DocumentKind =
  | "EDITAL"
  | "RETIFICACAO"
  | "PROVA"
  | "GABARITO"
  | "RESULTADO"
  | "CONCORRENCIA"
  | "COMUNICADO"
  | "PORTARIA"
  | "CONTRATO_BANCA"
  | "OUTRO";

export type ExtractionStatus = "PENDING" | "TEXT" | "PARTIAL" | "SCANNED" | "FAILED" | "NOT_APPLICABLE";

export interface ContestSeed {
  slug: string;
  title: string;
  organization: string;
  organizationSlug: string;
  organizationAcronym: string | null;
  state: string;
  status: "ENCERRADO";
  officialUrl: string;
  provider: "document_collector";
  externalId: string;
}

export interface DocumentCandidate {
  key: string;
  contestSlug: string;
  contestSeed?: ContestSeed;
  kind: DocumentKind;
  semanticType: string;
  title: string;
  sourceUrl: string;
  discoveryUrl: string;
  publishedAt: string | null;
  source: {
    name: string;
    domain: string;
    type: "OFFICIAL" | "EXAM_BOARD";
    official: boolean;
    reliabilityScore: number;
  };
  notice?: { number: string | null; year: number | null };
  exam?: {
    year: number | null;
    boardName: string | null;
    boardAcronym: string | null;
    boardSlug: string | null;
    boardSite: string | null;
    role: string | null;
    shift: string | null;
    questionCount: number | null;
  };
  relatedProofKey?: string;
}

export interface DownloadedDocument {
  buffer: Buffer;
  sha256: string;
  mimeType: "application/pdf";
  size: number;
  finalUrl: string;
  originalFilename: string | null;
  etag: string | null;
  lastModified: string | null;
  attempts: number;
}

export interface PdfExtraction {
  status: Extract<ExtractionStatus, "TEXT" | "PARTIAL" | "SCANNED" | "FAILED">;
  method: "pdf-parse@2.4.5";
  text: string | null;
  pageCount: number | null;
  error: string | null;
}
