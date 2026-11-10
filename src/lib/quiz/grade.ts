import type { AnswerKey, QuestionType, Response } from "./types";

/**
 * Grades ONE answer. Runs on the server only (it needs the answer key).
 * Kind to kids: ignores extra spaces, capital letters (unless the tutor
 * asks), commas in numbers, and accepts fractions like "3/4" for numbers.
 */
export function normalizeText(s: string, caseSensitive = false) {
  const t = s.normalize("NFKC").trim().replace(/\s+/g, " ").replace(/[.!?]+$/, "");
  return caseSensitive ? t : t.toLowerCase();
}

/** "1,000" -> 1000, "3/4" -> 0.75, "-2 1/2" -> -2.5, "50%" -> 0.5 ; returns NaN if not a number. */
export function parseNumber(input: string): number {
  const s = input.trim().replace(/,/g, "").replace(/\s+/g, " ").replace(/−/g, "-");
  if (!s) return NaN;
  const percent = s.match(/^(-?\d*\.?\d+)\s*%$/);
  if (percent) return Number(percent[1]) / 100;
  const mixed = s.match(/^(-?)(\d+) (\d+)\/(\d+)$/);
  if (mixed) {
    const v = Number(mixed[2]) + Number(mixed[3]) / Number(mixed[4]);
    return mixed[1] ? -v : v;
  }
  const frac = s.match(/^(-?\d*\.?\d+)\/(-?\d*\.?\d+)$/);
  if (frac) return Number(frac[2]) === 0 ? NaN : Number(frac[1]) / Number(frac[2]);
  return /^-?\d*\.?\d+(e-?\d+)?$/i.test(s) ? Number(s) : NaN;
}

export function isCorrect(type: QuestionType, key: AnswerKey, response: Response): boolean {
  if (response === null || response === undefined) return false;
  switch (type) {
    case "multiple_choice":
      return typeof response === "string" && response === (key as { correct: string }).correct;
    case "multiple_select": {
      if (!Array.isArray(response)) return false;
      const want = new Set((key as { correct: string[] }).correct);
      const got = new Set(response as string[]);
      return want.size === got.size && [...want].every((x) => got.has(x));
    }
    case "true_false": {
      const want = (key as { correct: boolean }).correct;
      const got = typeof response === "string" ? response === "true" : response;
      return got === want;
    }
    case "short_answer": {
      if (typeof response !== "string") return false;
      const k = key as { accepted: string[]; caseSensitive?: boolean };
      const got = normalizeText(response, k.caseSensitive);
      return k.accepted.some((a) => normalizeText(a, k.caseSensitive) === got);
    }
    case "numeric": {
      const k = key as { value: number; tolerance?: number };
      const got = typeof response === "string" ? parseNumber(response) : NaN;
      if (Number.isNaN(got)) return false;
      return Math.abs(got - k.value) <= Math.max(k.tolerance ?? 0, 1e-9);
    }
    case "fill_blank": {
      if (!Array.isArray(response)) return false;
      const blanks = (key as { blanks: string[][] }).blanks;
      return blanks.every((accepted, i) => {
        const got = normalizeText(String((response as string[])[i] ?? ""));
        return got !== "" && accepted.some((a) => normalizeText(a) === got);
      });
    }
    case "matching": {
      if (typeof response !== "object" || Array.isArray(response)) return false;
      const pairs = (key as { pairs: Record<string, string> }).pairs;
      const got = response as Record<string, string>;
      return Object.entries(pairs).every(([l, r]) => got[l] === r);
    }
    default:
      return false;
  }
}

/** A friendly description of the correct answer, for the results screen. */
export function describeAnswer(
  type: QuestionType,
  key: AnswerKey,
  choices: unknown,
  labels: { true: string; false: string },
): string {
  const list = Array.isArray(choices) ? (choices as { id: string; text: string }[]) : [];
  const text = (id: string) => list.find((c) => c.id === id)?.text ?? id;
  switch (type) {
    case "multiple_choice":
      return text((key as { correct: string }).correct);
    case "multiple_select":
      return (key as { correct: string[] }).correct.map(text).join(", ");
    case "true_false":
      return (key as { correct: boolean }).correct ? labels.true : labels.false;
    case "short_answer":
      return (key as { accepted: string[] }).accepted[0] ?? "";
    case "numeric":
      return String((key as { value: number }).value);
    case "fill_blank":
      return (key as { blanks: string[][] }).blanks.map((b) => b[0]).join(", ");
    case "matching": {
      const m = choices as { left: { id: string; text: string }[]; right: { id: string; text: string }[] };
      const pairs = (key as { pairs: Record<string, string> }).pairs;
      return Object.entries(pairs)
        .map(([l, r]) => `${m.left?.find((x) => x.id === l)?.text ?? l} → ${m.right?.find((x) => x.id === r)?.text ?? r}`)
        .join("; ");
    }
  }
}

/** Grade a whole attempt. */
export function gradeAttempt(
  questions: { id: string; type: QuestionType; points: number; answer: AnswerKey }[],
  responses: Record<string, Response>,
) {
  let score = 0;
  let max = 0;
  const results: Record<string, { correct: boolean; earned: number }> = {};
  for (const q of questions) {
    max += q.points;
    const correct = isCorrect(q.type, q.answer, responses[q.id]);
    const earned = correct ? q.points : 0;
    score += earned;
    results[q.id] = { correct, earned };
  }
  return { score, max, results, percent: max ? Math.round((score / max) * 100) : 0 };
}
