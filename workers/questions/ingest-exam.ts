import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";
import { normalizeExtractedText } from "../../src/lib/documents/pdf";
import { ANSWER_KEY_PARSER_VERSION, parseFgvAnswerKey } from "../../src/lib/questions/answer-key-parser";
import { QUESTION_CLASSIFIER_VERSION, RuleBasedQuestionClassifier } from "../../src/lib/questions/classifier";
import { EXAM_PARSER_VERSION, parseFgvObjectiveExam } from "../../src/lib/questions/parser";
import {
  PCMA_2012_ANSWER_KEY_TYPE,
  PCMA_2012_DISCIPLINE_RANGES,
  PCMA_2012_EXPECTED_QUESTIONS,
  PCMA_2012_PROOF_ID,
  PCMA_2012_SUBJECTS,
  PCMA_2012_SUBSUBJECTS,
  pcmaDisciplineForQuestion,
} from "../../src/lib/questions/pcma-2012";
import type { ExamPage, QuestionClassification } from "../../src/lib/questions/types";

export interface ExamIngestionOptions {
  proofId?: string;
  allUnprocessed?: boolean;
  dryRun?: boolean;
  force?: boolean;
  client?: SupabaseClient;
}

export interface ExamIngestionItemSummary {
  proofId: string;
  title: string;
  questionsFound: number;
  answersFound: number;
  answersLinked: number;
  annulled: number;
  subjectsClassified: number;
  subsubjectsClassified: number;
  reviewRequired: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: string[];
}

export interface ExamIngestionSummary {
  dryRun: boolean;
  parserVersion: string;
  answerKeyParserVersion: string;
  classifierVersion: string;
  proofsRequested: number;
  proofsProcessed: number;
  items: ExamIngestionItemSummary[];
  errors: Array<{ proofId: string; message: string }>;
  startedAt: string;
  finishedAt: string;
}

type ProofRow = {
  id: string;
  titulo: string;
  tipo: string | null;
  quantidade_questoes: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  sha256: string | null;
};

type AnswerKeyRow = {
  id: string;
  titulo: string;
  tipo: string;
  storage_bucket: string | null;
  storage_path: string | null;
  sha256: string | null;
  created_at: string;
};

type TaxonomyIds = {
  disciplines: Map<string, string>;
  subjects: Map<string, string>;
  subsubjects: Map<string, string>;
};

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function downloadStoredPdf(client: SupabaseClient, bucket: string | null, path: string | null): Promise<Buffer> {
  if (!bucket || !path) throw new Error("Documento sem bucket ou caminho de Storage.");
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error) throw error;
  const buffer = Buffer.from(await data.arrayBuffer());
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("Arquivo armazenado não possui assinatura PDF.");
  return buffer;
}

async function extractPages(buffer: Buffer): Promise<ExamPage[]> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.pages.map((page) => ({
      pageNumber: page.num,
      text: normalizeExtractedText(page.text),
    }));
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function loadProofs(client: SupabaseClient, options: ExamIngestionOptions): Promise<ProofRow[]> {
  let query = client.from("provas")
    .select("id,titulo,tipo,quantidade_questoes,storage_bucket,storage_path,sha256")
    .order("created_at");
  if (options.allUnprocessed) {
    const processed = await client.from("questao_ingestoes")
      .select("prova_id")
      .eq("status", "SUCCESS");
    if (processed.error && processed.error.code !== "42P01") throw processed.error;
    const ids = (processed.data ?? []).map((row) => row.prova_id);
    if (ids.length) query = query.not("id", "in", `(${ids.join(",")})`);
  } else {
    query = query.eq("id", options.proofId ?? PCMA_2012_PROOF_ID);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as ProofRow[];
}

async function loadAnswerKey(client: SupabaseClient, proofId: string): Promise<AnswerKeyRow> {
  const { data, error } = await client.from("gabaritos")
    .select("id,titulo,tipo,storage_bucket,storage_path,sha256,created_at")
    .eq("prova_id", proofId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data as AnswerKeyRow[];
  const selected = rows.find((row) => row.tipo === "DEFINITIVO")
    ?? rows.find((row) => row.tipo === "RETIFICADO")
    ?? rows[0];
  if (!selected) throw new Error("Nenhum gabarito vinculado à prova.");
  return selected;
}

async function ensureTaxonomy(client: SupabaseClient): Promise<TaxonomyIds> {
  const disciplines = new Map<string, string>();
  const subjects = new Map<string, string>();
  const subsubjects = new Map<string, string>();

  for (const range of PCMA_2012_DISCIPLINE_RANGES) {
    const { data, error } = await client.from("disciplinas").upsert({
      nome: range.discipline.name,
      slug: range.discipline.slug,
      metadata: { source: "official_answer_key", pilot: "pcma-2012-investigador-tipo-1" },
    }, { onConflict: "slug" }).select("id").single();
    if (error) throw error;
    disciplines.set(range.discipline.slug, data.id);
  }

  for (const item of PCMA_2012_SUBJECTS) {
    const disciplineId = disciplines.get(item.disciplineSlug);
    if (!disciplineId) throw new Error(`Disciplina ausente para o assunto ${item.slug}.`);
    const { data, error } = await client.from("assuntos").upsert({
      disciplina_id: disciplineId,
      nome: item.name,
      slug: item.slug,
      metadata: { classifier_version: QUESTION_CLASSIFIER_VERSION },
    }, { onConflict: "disciplina_id,slug" }).select("id").single();
    if (error) throw error;
    subjects.set(item.slug, data.id);
  }

  for (const item of PCMA_2012_SUBSUBJECTS) {
    const subjectId = subjects.get(item.subjectSlug);
    if (!subjectId) throw new Error(`Assunto ausente para o subassunto ${item.slug}.`);
    const { data, error } = await client.from("subassuntos").upsert({
      assunto_id: subjectId,
      nome: item.name,
      slug: item.slug,
      metadata: { classifier_version: QUESTION_CLASSIFIER_VERSION },
    }, { onConflict: "assunto_id,slug" }).select("id").single();
    if (error) throw error;
    subsubjects.set(item.slug, data.id);
  }

  return { disciplines, subjects, subsubjects };
}

function validatePilot(proof: ProofRow) {
  if (proof.id !== PCMA_2012_PROOF_ID) {
    throw new Error("O parser da Fase 5 está validado somente para a prova piloto PC-MA 2012.");
  }
  if (!proof.tipo?.includes("TIPO_1")) throw new Error("A prova piloto não está identificada como Tipo 1.");
}

function emptyTaxonomyIds(): TaxonomyIds {
  return { disciplines: new Map(), subjects: new Map(), subsubjects: new Map() };
}

function questionRow(input: {
  proof: ProofRow;
  answerKey: AnswerKeyRow;
  question: ReturnType<typeof parseFgvObjectiveExam>[number];
  answer: ReturnType<typeof parseFgvAnswerKey>[number];
  classification: QuestionClassification;
  taxonomy: TaxonomyIds;
}) {
  const { proof, answerKey, question, answer, classification, taxonomy } = input;
  return {
    prova_id: proof.id,
    numero: question.number,
    tipo: question.type,
    pagina: question.pageNumber,
    enunciado: question.statement,
    alternativa_a: question.alternatives.A,
    alternativa_b: question.alternatives.B,
    alternativa_c: question.alternatives.C,
    alternativa_d: question.alternatives.D,
    alternativa_e: question.alternatives.E,
    resposta: answer.answer,
    anulada: answer.annulled,
    texto_bruto: question.rawText,
    parse_quality: question.parseQuality,
    parser_version: EXAM_PARSER_VERSION,
    content_hash: question.contentHash,
    classification_status: classification.overallStatus,
    classification_confidence: classification.overallConfidence,
    disciplina_id: taxonomy.disciplines.get(classification.discipline.slug) ?? null,
    disciplina_status: classification.disciplineStatus,
    disciplina_confidence: classification.disciplineConfidence,
    assunto_id: classification.subject ? taxonomy.subjects.get(classification.subject.slug) ?? null : null,
    assunto_status: classification.subjectStatus,
    assunto_confidence: classification.subjectConfidence,
    subassunto_id: classification.subsubject ? taxonomy.subsubjects.get(classification.subsubject.slug) ?? null : null,
    subassunto_status: classification.subsubjectStatus,
    subassunto_confidence: classification.subsubjectConfidence,
    classifier_version: QUESTION_CLASSIFIER_VERSION,
    classification_reason: classification.reason,
    gabarito_id: answerKey.id,
    answer_key_verified: true,
    metadata: {
      warnings: question.warnings,
      needs_review: question.needsReview,
      proof_sha256: proof.sha256,
      answer_key_sha256: answerKey.sha256,
      discipline_source: "official_answer_key_header",
      answer_source: "official_definitive_answer_key",
      pilot: "pcma-2012-investigador-tipo-1",
    },
  };
}

async function processProof(client: SupabaseClient, proof: ProofRow, options: ExamIngestionOptions): Promise<ExamIngestionItemSummary> {
  validatePilot(proof);
  const expectedQuestions = proof.quantidade_questoes ?? PCMA_2012_EXPECTED_QUESTIONS;
  const answerKey = await loadAnswerKey(client, proof.id);
  const [proofPages, answerKeyPages] = await Promise.all([
    downloadStoredPdf(client, proof.storage_bucket, proof.storage_path).then(extractPages),
    downloadStoredPdf(client, answerKey.storage_bucket, answerKey.storage_path).then(extractPages),
  ]);
  const questions = parseFgvObjectiveExam(proofPages, expectedQuestions);
  const answers = parseFgvAnswerKey(answerKeyPages.map((page) => page.text).join("\n"), PCMA_2012_ANSWER_KEY_TYPE, expectedQuestions);
  const errors: string[] = [];
  if (questions.length !== expectedQuestions) errors.push(`Esperadas ${expectedQuestions} questões; encontradas ${questions.length}.`);
  if (answers.length !== expectedQuestions) errors.push(`Esperadas ${expectedQuestions} respostas; encontradas ${answers.length}.`);
  const answerByNumber = new Map(answers.map((answer) => [answer.number, answer]));
  const missingAnswers = questions.filter((question) => !answerByNumber.has(question.number)).map((question) => question.number);
  if (missingAnswers.length) errors.push(`Questões sem resposta vinculável: ${missingAnswers.join(", ")}.`);
  if (errors.length) throw new Error(errors.join(" "));

  const classifier = new RuleBasedQuestionClassifier();
  const classified = questions.map((question) => {
    const discipline = pcmaDisciplineForQuestion(question.number);
    if (!discipline) throw new Error(`Faixa oficial de disciplina ausente para a questão ${question.number}.`);
    return { question, classification: classifier.classify(question, { discipline }) };
  });
  const taxonomy = options.dryRun ? emptyTaxonomyIds() : await ensureTaxonomy(client);
  const existingResult = await client.from("questoes").select("id,numero,content_hash").eq("prova_id", proof.id);
  if (existingResult.error && existingResult.error.code !== "42703") throw existingResult.error;
  const existingByNumber = new Map((existingResult.data ?? []).map((row) => [row.numero, row]));
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  for (const { question } of classified) {
    const existing = existingByNumber.get(question.number);
    if (!existing) inserted += 1;
    else if (existing.content_hash === question.contentHash && !options.force) unchanged += 1;
    else updated += 1;
  }

  if (!options.dryRun) {
    const rows = classified.map(({ question, classification }) => questionRow({
      proof,
      answerKey,
      question,
      answer: answerByNumber.get(question.number)!,
      classification,
      taxonomy,
    }));
    const toWrite = options.force
      ? rows
      : rows.filter((row) => existingByNumber.get(row.numero)?.content_hash !== row.content_hash);
    if (toWrite.length) {
      const { error } = await client.from("questoes").upsert(toWrite, { onConflict: "prova_id,numero" });
      if (error) throw error;
    }
  }

  return {
    proofId: proof.id,
    title: proof.titulo,
    questionsFound: questions.length,
    answersFound: answers.length,
    answersLinked: questions.length - missingAnswers.length,
    annulled: answers.filter((answer) => answer.annulled).length,
    subjectsClassified: classified.filter((item) => item.classification.subject).length,
    subsubjectsClassified: classified.filter((item) => item.classification.subsubject).length,
    reviewRequired: classified.filter((item) => item.classification.overallStatus === "REVIEW_REQUIRED").length,
    inserted,
    updated,
    unchanged,
    errors,
  };
}

export async function runExamIngestion(options: ExamIngestionOptions = {}): Promise<ExamIngestionSummary> {
  if (options.proofId && options.allUnprocessed) throw new Error("Use --proof ou --all-unprocessed, não ambos.");
  if (options.force && process.env.NODE_ENV === "production" && process.env.RADAR_ALLOW_FORCE_REPROCESSING !== "1") {
    throw new Error("--force exige RADAR_ALLOW_FORCE_REPROCESSING=1 em produção.");
  }
  const client = options.client ?? adminClient();
  const startedAt = new Date().toISOString();
  const proofs = await loadProofs(client, options);
  if (!proofs.length) throw new Error("Nenhuma prova elegível encontrada.");
  const summary: ExamIngestionSummary = {
    dryRun: Boolean(options.dryRun),
    parserVersion: EXAM_PARSER_VERSION,
    answerKeyParserVersion: ANSWER_KEY_PARSER_VERSION,
    classifierVersion: QUESTION_CLASSIFIER_VERSION,
    proofsRequested: proofs.length,
    proofsProcessed: 0,
    items: [],
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  for (const proof of proofs) {
    let ingestionId: string | null = null;
    if (!options.dryRun) {
      const answerKey = await loadAnswerKey(client, proof.id);
      const { data, error } = await client.from("questao_ingestoes").insert({
        prova_id: proof.id,
        gabarito_id: answerKey.id,
        status: "RUNNING",
        parser_version: EXAM_PARSER_VERSION,
        classifier_version: QUESTION_CLASSIFIER_VERSION,
        prova_sha256: proof.sha256,
        gabarito_sha256: answerKey.sha256,
        metadata: { force: Boolean(options.force), pilot: "pcma-2012-investigador-tipo-1" },
      }).select("id").single();
      if (error) throw error;
      ingestionId = data.id;
    }
    try {
      const item = await processProof(client, proof, options);
      summary.items.push(item);
      summary.proofsProcessed += 1;
      if (ingestionId) {
        const { error } = await client.from("questao_ingestoes").update({
          status: "SUCCESS",
          questoes_encontradas: item.questionsFound,
          questoes_inseridas: item.inserted,
          questoes_atualizadas: item.updated,
          respostas_vinculadas: item.answersLinked,
          erros: item.errors,
          finished_at: new Date().toISOString(),
          metadata: {
            force: Boolean(options.force),
            unchanged: item.unchanged,
            annulled: item.annulled,
            subjects_classified: item.subjectsClassified,
            subsubjects_classified: item.subsubjectsClassified,
            review_required: item.reviewRequired,
          },
        }).eq("id", ingestionId);
        if (error) throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.errors.push({ proofId: proof.id, message });
      if (ingestionId) {
        await client.from("questao_ingestoes").update({
          status: "FAILED",
          erros: [{ message }],
          finished_at: new Date().toISOString(),
        }).eq("id", ingestionId);
      }
    }
  }
  summary.finishedAt = new Date().toISOString();
  return summary;
}
