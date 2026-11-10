import { QUESTION_TYPES, countBlanks, type AnswerKey, type Choice, type MatchingChoices, type QuestionType } from "./types";

/**
 * CSV QUESTION IMPORT  (template: public/quiz-template.csv)
 *
 * Columns: type, prompt, choices, correct, hint, explanation, points, tolerance
 *   multiple_choice  choices: "7|12|13"            correct: "12"            (the right choice's text)
 *   multiple_select  choices: "3|4|7|8"            correct: "4|8"
 *   true_false       choices: (empty)              correct: "true" or "false"
 *   short_answer     choices: (empty)              correct: "2014|two thousand fourteen"   (any of these)
 *   numeric          choices: (empty)              correct: "0.75"   tolerance: "0.01"
 *   fill_blank       prompt: "5 + ___ = 9"         correct: "4;four"   (blanks split by |, options by ;)
 *   matching         choices: "cat=meow|dog=woof"  correct: (empty)
 */
export type ImportedQuestion = {
  type: QuestionType;
  prompt: string;
  choices: Choice[] | MatchingChoices;
  answer: AnswerKey;
  hint: string | null;
  explanation: string | null;
  points: number;
};

/** Minimal CSV reader that handles quotes, commas and new lines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const split = (s: string, sep = "|") => s.split(sep).map((x) => x.trim()).filter(Boolean);
const letters = "abcdefghijklmnopqrstuvwxyz";

export function importQuestionsCsv(text: string): { questions: ImportedQuestion[]; errors: string[] } {
  const rows = parseCsv(text);
  const errors: string[] = [];
  const questions: ImportedQuestion[] = [];
  if (!rows.length) return { questions, errors: ["The file is empty."] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  if (col("type") < 0 || col("prompt") < 0) return { questions, errors: ['The first row must be the header: type,prompt,choices,correct,hint,explanation,points,tolerance'] };

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (name: string) => (col(name) >= 0 ? (r[col(name)] ?? "").trim() : "");
    const type = get("type") as QuestionType;
    const prompt = get("prompt");
    const correct = get("correct");
    if (!QUESTION_TYPES.includes(type)) return errors.push(`Row ${line}: unknown type "${type}".`);
    if (!prompt) return errors.push(`Row ${line}: prompt is empty.`);
    const points = Number(get("points") || 1);
    const base = { type, prompt, hint: get("hint") || null, explanation: get("explanation") || null, points: Number.isFinite(points) && points >= 0 ? Math.round(points) : 1 };

    try {
      switch (type) {
        case "multiple_choice":
        case "multiple_select": {
          const texts = split(get("choices"));
          if (texts.length < 2) throw new Error("needs at least 2 choices");
          const choices = texts.map((t, k) => ({ id: letters[k], text: t }));
          const ids = split(correct).map((c) => {
            const found = choices.find((ch) => ch.text === c);
            if (!found) throw new Error(`correct answer "${c}" is not one of the choices`);
            return found.id;
          });
          if (!ids.length) throw new Error("no correct answer");
          if (type === "multiple_choice" && ids.length !== 1) throw new Error("multiple_choice needs exactly one correct answer");
          questions.push({ ...base, choices, answer: type === "multiple_choice" ? { correct: ids[0] } : { correct: ids } });
          break;
        }
        case "true_false": {
          const v = correct.toLowerCase();
          if (v !== "true" && v !== "false") throw new Error('correct must be "true" or "false"');
          questions.push({ ...base, choices: [], answer: { correct: v === "true" } });
          break;
        }
        case "short_answer": {
          const accepted = split(correct);
          if (!accepted.length) throw new Error("no accepted answers");
          questions.push({ ...base, choices: [], answer: { accepted } });
          break;
        }
        case "numeric": {
          const value = Number(correct);
          if (!Number.isFinite(value)) throw new Error("correct must be a number");
          const tolerance = Number(get("tolerance") || 0);
          questions.push({ ...base, choices: [], answer: { value, tolerance: Number.isFinite(tolerance) ? Math.abs(tolerance) : 0 } });
          break;
        }
        case "fill_blank": {
          const blanks = split(correct).map((b) => split(b, ";"));
          if (!blanks.length) throw new Error("no answers for the blanks");
          if (countBlanks(prompt) !== blanks.length) throw new Error(`prompt has ${countBlanks(prompt)} blanks (___) but ${blanks.length} answers`);
          questions.push({ ...base, choices: [], answer: { blanks } });
          break;
        }
        case "matching": {
          const pairs = split(get("choices")).map((p) => p.split("=").map((x) => x.trim()));
          if (pairs.length < 2 || pairs.some((p) => p.length !== 2 || !p[0] || !p[1])) throw new Error('choices must look like "left=right|left=right"');
          const left = pairs.map(([l], k) => ({ id: `l${k + 1}`, text: l }));
          const right = pairs.map(([, r], k) => ({ id: `r${k + 1}`, text: r }));
          const answer = { pairs: Object.fromEntries(left.map((l, k) => [l.id, right[k].id])) };
          questions.push({ ...base, choices: { left, right: shuffleStable(right) }, answer });
          break;
        }
      }
    } catch (e) {
      errors.push(`Row ${line}: ${(e as Error).message}.`);
    }
  });
  return { questions, errors };
}

/** Reorders the right-hand matching column so answers aren't simply in order (same result every time). */
export function shuffleStable<T>(items: T[]): T[] {
  if (items.length < 2) return items;
  return [...items.slice(1), items[0]].reverse();
}
