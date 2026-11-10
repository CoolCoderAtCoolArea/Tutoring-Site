import { z } from "zod";
import { countBlanks, type QuestionType } from "./types";

/**
 * Checks a question sent by the quiz builder before saving it.
 * Returns the public part (choices) and the private answer key separately.
 */
const choice = z.object({ id: z.string().min(1).max(10), text: z.string().trim().min(1).max(500) });

const base = z.object({
  prompt: z.string().trim().min(1).max(2000),
  image_url: z.string().url().startsWith("https://").max(500).nullable().optional(),
  hint: z.string().trim().max(500).nullable().optional(),
  explanation: z.string().trim().max(2000).nullable().optional(),
  points: z.number().int().min(0).max(100).default(1),
});

export const questionSchema = z.discriminatedUnion("type", [
  base.extend({ type: z.literal("multiple_choice"), choices: z.array(choice).min(2).max(8), answer: z.object({ correct: z.string() }) }),
  base.extend({ type: z.literal("multiple_select"), choices: z.array(choice).min(2).max(8), answer: z.object({ correct: z.array(z.string()).min(1) }) }),
  base.extend({ type: z.literal("true_false"), choices: z.array(choice).max(0), answer: z.object({ correct: z.boolean() }) }),
  base.extend({ type: z.literal("short_answer"), choices: z.array(choice).max(0), answer: z.object({ accepted: z.array(z.string().trim().min(1).max(200)).min(1).max(20), caseSensitive: z.boolean().optional() }) }),
  base.extend({ type: z.literal("numeric"), choices: z.array(choice).max(0), answer: z.object({ value: z.number().finite(), tolerance: z.number().min(0).optional() }) }),
  base.extend({ type: z.literal("fill_blank"), choices: z.array(choice).max(0), answer: z.object({ blanks: z.array(z.array(z.string().trim().min(1).max(100)).min(1)).min(1).max(10) }) }),
  base.extend({
    type: z.literal("matching"),
    choices: z.object({ left: z.array(choice).min(2).max(10), right: z.array(choice).min(2).max(10) }),
    answer: z.object({ pairs: z.record(z.string(), z.string()) }),
  }),
]);

export type QuestionInput = z.infer<typeof questionSchema>;

export function validateQuestion(raw: unknown): { ok: true; q: QuestionInput } | { ok: false; error: string } {
  const parsed = questionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  const q = parsed.data;
  const ids = (list: { id: string }[]) => new Set(list.map((c) => c.id));
  switch (q.type as QuestionType) {
    case "multiple_choice": {
      const a = q.answer as { correct: string };
      if (!ids(q.choices as { id: string }[]).has(a.correct)) return { ok: false, error: "pick the correct choice" };
      break;
    }
    case "multiple_select": {
      const a = q.answer as { correct: string[] };
      const s = ids(q.choices as { id: string }[]);
      if (!a.correct.every((c) => s.has(c))) return { ok: false, error: "pick the correct choices" };
      break;
    }
    case "fill_blank": {
      const a = q.answer as { blanks: string[][] };
      if (countBlanks(q.prompt) !== a.blanks.length) return { ok: false, error: "the number of ___ blanks must match the answers" };
      break;
    }
    case "matching": {
      const c = q.choices as { left: { id: string }[]; right: { id: string }[] };
      const a = q.answer as { pairs: Record<string, string> };
      const l = ids(c.left), r = ids(c.right);
      if (Object.keys(a.pairs).length !== c.left.length || !Object.entries(a.pairs).every(([k, v]) => l.has(k) && r.has(v)))
        return { ok: false, error: "every left item needs a match" };
      break;
    }
  }
  return { ok: true, q };
}
