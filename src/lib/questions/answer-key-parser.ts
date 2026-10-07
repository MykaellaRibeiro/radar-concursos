import type { AlternativeLetter, ParsedAnswer } from "./types";

export const ANSWER_KEY_PARSER_VERSION = "fgv-answer-key-v1.0.0";

function typeBlock(text: string, typeNumber: number): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  const padded = String(typeNumber).padStart(2, "0");
  const startExpression = new RegExp(`GABARITO\\s+DEFINITIVO\\s+TIPO\\s+0?${typeNumber}\\b`, "i");
  const start = normalized.search(startExpression);
  if (start < 0) throw new Error(`Bloco do gabarito Tipo ${padded} não encontrado.`);
  const remainder = normalized.slice(start);
  const nextType = remainder.slice(1).search(/GABARITO\s+DEFINITIVO\s+TIPO\s+0?\d+\b/i);
  return nextType < 0 ? remainder : remainder.slice(0, nextType + 1);
}

export function parseFgvAnswerKey(text: string, typeNumber: number, expectedQuestions?: number): ParsedAnswer[] {
  const block = typeBlock(text, typeNumber);
  const answers = new Map<number, ParsedAnswer>();
  const pattern = /(?:^|\n)(\d{1,2})\s*[–—-]\s*([A-E*])\s*(?=\n|$)/g;

  for (const match of block.matchAll(pattern)) {
    const number = Number(match[1]);
    if (number < 1 || (expectedQuestions && number > expectedQuestions)) continue;
    const token = match[2];
    answers.set(number, {
      number,
      answer: token === "*" ? null : token as AlternativeLetter,
      annulled: token === "*",
    });
  }

  return [...answers.values()].sort((left, right) => left.number - right.number);
}
