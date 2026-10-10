import { createHash } from "node:crypto";
import { normalizeExtractedText } from "@/lib/documents/pdf";
import type { AlternativeLetter, ExamPage, ParsedQuestion } from "./types";

export const EXAM_PARSER_VERSION = "fgv-objective-v1.0.0";
export const CESGRANRIO_EXAM_PARSER_VERSION = "cesgranrio-objective-v1.0.0";

const LETTERS: AlternativeLetter[] = ["A", "B", "C", "D", "E"];
const QUESTION_MARKER = /(?:^|\n)(\d{2})\.\s+/g;
const CESGRANRIO_QUESTION_MARKER = /(?:^|\n)(\d{1,3})\s*(?=\n)/g;
const ALTERNATIVE_MARKER = /(?:^|\n)\(([A-E])\)[\t ]*/g;
const VISUAL_REFERENCE = /\b(charge|cartaz|gr[aá]fico|figura|imagem|documento a seguir|bot[aã]o)\b/i;

interface Marker {
  number: number;
  contentStart: number;
  markerStart: number;
}

function normalizeSegment(value: string): string {
  return normalizeExtractedText(value)
    .replace(/^CONCURSO PÚBLICO PARA O CARGO DE INVESTIGADOR DE POLÍCIA\n?/i, "")
    .replace(/^(?:\d+\s*[–-]\s*)?PROVA TIPO \d+\s*[–-]\s*BRANCA(?:\s*[–-]\s*\d+)?\n?/i, "")
    .trim();
}

function normalizeCesgranrioSegment(value: string): string {
  return normalizeExtractedText(value)
    .replace(/^(?:PROVA\s+[A-Z]\s*[-–].*|GABARITO\s+\d+|RASCUNHO|BANCO DA AMAZ[ÔO]NIA|BNB|ANALISTA BANC[ÁA]RIO\s+1\d*)$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function questionMarkers(text: string): Marker[] {
  return [...text.matchAll(QUESTION_MARKER)].map((match) => ({
    number: Number(match[1]),
    markerStart: match.index,
    contentStart: match.index + match[0].length,
  })).filter((marker) => marker.number >= 1 && marker.number <= 99);
}

function findAlternativeSequence(text: string) {
  const matches = [...text.matchAll(ALTERNATIVE_MARKER)].map((match) => ({
    letter: match[1] as AlternativeLetter,
    markerStart: match.index,
    contentStart: match.index + match[0].length,
  }));

  for (let start = 0; start < matches.length; start += 1) {
    if (matches[start].letter !== "A") continue;
    const sequence = [matches[start]];
    let cursor = start + 1;
    for (const expected of LETTERS.slice(1)) {
      while (cursor < matches.length && matches[cursor].letter !== expected) cursor += 1;
      if (cursor >= matches.length) break;
      sequence.push(matches[cursor]);
      cursor += 1;
    }
    if (sequence.length === LETTERS.length) return sequence;
  }
  return [];
}

function hashQuestion(number: number, statement: string, alternatives: Record<AlternativeLetter, string | null>): string {
  return createHash("sha256")
    .update(JSON.stringify({ number, statement, alternatives }))
    .digest("hex");
}

function parseCandidate(
  number: number,
  pageNumber: number,
  rawValue: string,
  normalize: (value: string) => string = normalizeSegment,
): ParsedQuestion | null {
  const rawText = normalize(rawValue);
  if (rawText.length < 20) return null;
  const markers = findAlternativeSequence(rawText);
  if (markers.length !== LETTERS.length) return null;

  const statement = normalize(rawText.slice(0, markers[0].markerStart));
  if (statement.length < 10) return null;

  const alternatives = Object.fromEntries(LETTERS.map((letter, index) => {
    const marker = markers[index];
    const nextMarker = markers[index + 1];
    const value = normalize(rawText.slice(marker.contentStart, nextMarker?.markerStart ?? rawText.length));
    return [letter, value || null];
  })) as Record<AlternativeLetter, string | null>;

  const warnings: string[] = [];
  const emptyAlternatives = LETTERS.filter((letter) => !alternatives[letter]);
  if (emptyAlternatives.length) warnings.push(`Alternativas sem texto extraído: ${emptyAlternatives.join(", ")}.`);
  if (VISUAL_REFERENCE.test(statement)) warnings.push("O enunciado referencia conteúdo visual; conferir o PDF.");
  const filledAlternatives = LETTERS.length - emptyAlternatives.length;
  const parseQuality = Number(Math.max(0, Math.min(1,
    0.45 + filledAlternatives * 0.1 - (VISUAL_REFERENCE.test(statement) ? 0.05 : 0),
  )).toFixed(3));

  return {
    number,
    pageNumber,
    type: "MULTIPLE_CHOICE",
    statement,
    alternatives,
    rawText,
    parseQuality,
    needsReview: parseQuality < 0.85 || warnings.length > 0,
    warnings,
    contentHash: hashQuestion(number, statement, alternatives),
  };
}

export function parseFgvObjectiveExam(pages: readonly ExamPage[], expectedQuestions?: number): ParsedQuestion[] {
  const candidates = new Map<number, ParsedQuestion>();

  for (const page of pages) {
    const normalizedPage = normalizeExtractedText(page.text);
    const markers = questionMarkers(normalizedPage);
    for (let index = 0; index < markers.length; index += 1) {
      const marker = markers[index];
      const next = markers[index + 1];
      const parsed = parseCandidate(
        marker.number,
        page.pageNumber,
        normalizedPage.slice(marker.contentStart, next?.markerStart ?? normalizedPage.length),
      );
      if (!parsed) continue;
      const existing = candidates.get(parsed.number);
      if (!existing || parsed.parseQuality > existing.parseQuality || parsed.rawText.length > existing.rawText.length) {
        candidates.set(parsed.number, parsed);
      }
    }
  }

  const questions = [...candidates.values()].sort((left, right) => left.number - right.number);
  if (expectedQuestions && questions.some((question) => question.number > expectedQuestions)) {
    return questions.filter((question) => question.number <= expectedQuestions);
  }
  return questions;
}

export function parseCesgranrioObjectiveExam(pages: readonly ExamPage[], expectedQuestions?: number): ParsedQuestion[] {
  const normalizedPages = pages.map((page) => ({ ...page, text: normalizeExtractedText(page.text) }));
  const pageOffsets: Array<{ start: number; pageNumber: number }> = [];
  let combined = "";
  for (const page of normalizedPages) {
    pageOffsets.push({ start: combined.length, pageNumber: page.pageNumber });
    combined += `${combined ? "\n" : ""}${page.text}`;
  }
  const markers = [...combined.matchAll(CESGRANRIO_QUESTION_MARKER)].map((match) => ({
    number: Number(match[1]),
    markerStart: match.index,
    contentStart: match.index + match[0].length,
  })).filter((marker) => marker.number >= 1 && marker.number <= (expectedQuestions ?? 200));
  const maximum = expectedQuestions ?? Math.max(0, ...markers.map((marker) => marker.number));
  const pageNumberFor = (markerStart: number) => (
    [...pageOffsets].reverse().find((page) => page.start <= markerStart)?.pageNumber ?? 1
  );
  const candidatesByNumber = new Map<number, Array<{ markerStart: number; question: ParsedQuestion }>>();
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    if (marker.number > maximum) continue;
    for (let endIndex = index + 1; endIndex <= markers.length; endIndex += 1) {
      const end = markers[endIndex]?.markerStart ?? combined.length;
      const parsed = parseCandidate(
        marker.number,
        pageNumberFor(marker.markerStart),
        combined.slice(marker.contentStart, end),
        normalizeCesgranrioSegment,
      );
      if (!parsed) continue;
      if (/^(?:\d{1,3}\s*\n)+/.test(parsed.statement)) continue;
      const group = candidatesByNumber.get(marker.number) ?? [];
      group.push({ markerStart: marker.markerStart, question: parsed });
      candidatesByNumber.set(marker.number, group);
      break;
    }
  }
  const questions: ParsedQuestion[] = [];
  let minimumPage = 1;
  for (let number = 1; number <= maximum; number += 1) {
    const candidate = (candidatesByNumber.get(number) ?? [])
      .filter((item) => item.question.pageNumber >= minimumPage)
      .sort((left, right) => left.question.pageNumber - right.question.pageNumber || left.markerStart - right.markerStart)[0];
    if (!candidate) continue;
    questions.push(candidate.question);
    minimumPage = candidate.question.pageNumber;
  }
  return questions;
}
