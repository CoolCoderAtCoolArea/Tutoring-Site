/**
 * QUIZ DATA SHAPES
 *
 * A question has public parts (quiz_questions: prompt, choices, hint) that
 * students can read, and a private answer key (quiz_question_keys) that only
 * tutors and the server can read.
 *
 * Type              choices (public)                         answer (private key)                       student's response
 * ----------------  ---------------------------------------  -----------------------------------------  -------------------
 * multiple_choice   [{id:"a",text:"..."}, ...]               {correct:"a"}                              "a"
 * multiple_select   [{id:"a",text:"..."}, ...]               {correct:["a","c"]}                        ["a","c"]
 * true_false        []                                       {correct:true}                             true
 * short_answer      []                                       {accepted:["Paris"], caseSensitive?:false} "paris"
 * numeric           []                                       {value:0.75, tolerance:0.01}               "0.75"
 * fill_blank        []  (prompt has ___ for each blank)      {blanks:[["4","four"], ...]}               ["4", ...]
 * matching          {left:[{id,text}], right:[{id,text}]}    {pairs:{l1:"r2", ...}}                     {l1:"r2", ...}
 *
 * Math: write LaTeX between dollar signs, e.g.  Solve $x + 7 = 15$
 */
export const QUESTION_TYPES = [
  "multiple_choice",
  "multiple_select",
  "true_false",
  "short_answer",
  "numeric",
  "fill_blank",
  "matching",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type Choice = { id: string; text: string };
export type MatchingChoices = { left: Choice[]; right: Choice[] };

export type AnswerKey =
  | { correct: string }
  | { correct: string[] }
  | { correct: boolean }
  | { accepted: string[]; caseSensitive?: boolean }
  | { value: number; tolerance?: number }
  | { blanks: string[][] }
  | { pairs: Record<string, string> };

export type Response = string | string[] | boolean | Record<string, string> | null | undefined;

export type PublicQuestion = {
  id: string;
  quiz_id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  image_url: string | null;
  choices: Choice[] | MatchingChoices;
  hint: string | null;
  points: number;
};

export type QuestionWithKey = PublicQuestion & { answer: AnswerKey; explanation: string | null };

/** Count the blanks ("___") in a fill-in-the-blank prompt. */
export function countBlanks(prompt: string) {
  return (prompt.match(/_{3,}/g) || []).length;
}
