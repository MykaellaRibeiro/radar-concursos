import type { DocumentKind } from "./types";

const folderByKind: Record<DocumentKind, string> = {
  EDITAL: "editais",
  RETIFICACAO: "editais",
  PROVA: "provas",
  GABARITO: "gabaritos",
  RESULTADO: "resultados",
  CONCORRENCIA: "documentos",
  COMUNICADO: "documentos",
  PORTARIA: "documentos",
  CONTRATO_BANCA: "documentos",
  OUTRO: "documentos",
};

export function documentStoragePath(input: {
  kind: DocumentKind;
  contestId: string;
  sha256: string;
  year?: number | null;
  proofId?: string | null;
}): string {
  if (!/^[a-f0-9]{64}$/.test(input.sha256)) throw new Error("SHA-256 inválido para storage path.");
  const folder = folderByKind[input.kind];
  if (input.kind === "PROVA") return `${folder}/${input.contestId}/${input.year ?? "sem-ano"}/${input.sha256}.pdf`;
  if (input.kind === "GABARITO" && input.proofId) return `${folder}/${input.proofId}/${input.sha256}.pdf`;
  return `${folder}/${input.contestId}/${input.sha256}.pdf`;
}
