import type { DisciplineRange, SubjectSeed, SubsubjectSeed } from "./types";
import {
  PCMA_2012_ANSWER_KEY_TYPE,
  PCMA_2012_DISCIPLINE_RANGES,
  PCMA_2012_EXPECTED_QUESTIONS,
  PCMA_2012_PROOF_ID,
  PCMA_2012_SUBJECTS,
  PCMA_2012_SUBSUBJECTS,
} from "./pcma-2012";

export type ExamParserKind = "FGV" | "CESGRANRIO";

export interface ExamProfileProof {
  id: string;
  concurso_slug: string | null;
  banca_slug: string | null;
  titulo: string;
  tipo: string | null;
}

export interface ExamIngestionProfile {
  key: string;
  parser: ExamParserKind;
  expectedQuestions: number;
  answerKeyNumber: number;
  disciplineRanges: readonly DisciplineRange[];
  subjects: readonly SubjectSeed[];
  subsubjects: readonly SubsubjectSeed[];
  matches: (proof: ExamProfileProof) => boolean;
}

const basaRanges: readonly DisciplineRange[] = [
  { start: 1, end: 5, discipline: { name: "Língua Portuguesa", slug: "lingua-portuguesa" } },
  { start: 6, end: 10, discipline: { name: "Língua Inglesa", slug: "lingua-inglesa" } },
  { start: 11, end: 15, discipline: { name: "Inovação e Atualidades do Mercado Financeiro", slug: "inovacao-e-atualidades-do-mercado-financeiro" } },
  { start: 16, end: 20, discipline: { name: "Conhecimento Socioambiental, Compliance e Ética", slug: "conhecimento-socioambiental-compliance-e-etica" } },
  { start: 21, end: 25, discipline: { name: "Noções de Informática", slug: "nocoes-de-informatica" } },
  { start: 26, end: 30, discipline: { name: "Qualidade do Atendimento e Diversidade", slug: "qualidade-do-atendimento-e-diversidade" } },
  { start: 31, end: 35, discipline: { name: "Matemática Financeira", slug: "matematica-financeira" } },
  { start: 36, end: 40, discipline: { name: "Noções de Probabilidade e Estatística", slug: "nocoes-de-probabilidade-e-estatistica" } },
  { start: 41, end: 55, discipline: { name: "Conhecimentos Bancários", slug: "conhecimentos-bancarios" } },
  { start: 56, end: 70, discipline: { name: "Vendas e Negociação", slug: "vendas-e-negociacao" } },
];

const bnbRanges: readonly DisciplineRange[] = [
  { start: 1, end: 10, discipline: { name: "Língua Portuguesa", slug: "lingua-portuguesa" } },
  { start: 11, end: 20, discipline: { name: "Matemática e Raciocínio Lógico-quantitativo", slug: "matematica-e-raciocinio-logico-quantitativo" } },
  { start: 21, end: 60, discipline: { name: "Conhecimentos Bancários", slug: "conhecimentos-bancarios" } },
];

export const examIngestionProfiles: readonly ExamIngestionProfile[] = [
  {
    key: "pcma-2012-investigador-tipo-1",
    parser: "FGV",
    expectedQuestions: PCMA_2012_EXPECTED_QUESTIONS,
    answerKeyNumber: PCMA_2012_ANSWER_KEY_TYPE,
    disciplineRanges: PCMA_2012_DISCIPLINE_RANGES,
    subjects: PCMA_2012_SUBJECTS,
    subsubjects: PCMA_2012_SUBSUBJECTS,
    matches: (proof) => proof.id === PCMA_2012_PROOF_ID,
  },
  {
    key: "basa-2024-tecnico-bancario-gabarito-3",
    parser: "CESGRANRIO",
    expectedQuestions: 70,
    answerKeyNumber: 3,
    disciplineRanges: basaRanges,
    subjects: [],
    subsubjects: [],
    matches: (proof) => proof.concurso_slug === "banco-da-amazonia-2024" && proof.tipo === "OBJETIVA_GABARITO_3",
  },
  {
    key: "bnb-2024-analista-bancario-gabarito-1",
    parser: "CESGRANRIO",
    expectedQuestions: 60,
    answerKeyNumber: 1,
    disciplineRanges: bnbRanges,
    subjects: [],
    subsubjects: [],
    matches: (proof) => proof.concurso_slug === "banco-do-nordeste-2024" && proof.tipo === "OBJETIVA_GABARITO_1",
  },
];

export function resolveExamIngestionProfile(proof: ExamProfileProof): ExamIngestionProfile {
  const profile = examIngestionProfiles.find((candidate) => candidate.matches(proof));
  if (!profile) {
    throw new Error(`Nenhum perfil de extração validado para a prova ${proof.id} (${proof.titulo}).`);
  }
  return profile;
}

export function disciplineForQuestion(profile: ExamIngestionProfile, number: number) {
  return profile.disciplineRanges.find((range) => number >= range.start && number <= range.end)?.discipline ?? null;
}
