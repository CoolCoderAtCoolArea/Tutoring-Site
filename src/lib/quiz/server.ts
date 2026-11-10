import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AnswerKey, QuestionType } from "./types";
import type { QuizAttempt } from "@/lib/types";

/**
 * Loads an attempt AS THE LOGGED-IN USER (so RLS proves it's theirs or their
 * child's), plus the quiz settings. Returns null if they may not see it.
 */
export async function loadOwnAttempt(attemptId: string) {
  const supabase = await createClient();
  const { data: attempt } = await supabase.from("quiz_attempts").select("*").eq("id", attemptId).maybeSingle();
  if (!attempt) return null;
  const { data: quiz } = await supabase.from("quizzes").select("*").eq("id", attempt.quiz_id).maybeSingle();
  if (!quiz) return null;
  return { attempt: attempt as QuizAttempt, quiz, supabase };
}

/**
 * The answer key. Students can never read it through the API; the server
 * reads it with the admin client ONLY after loadOwnAttempt() succeeded.
 */
export async function loadKeys(quizId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("quiz_questions")
    .select("id, type, points, choices, hint, quiz_question_keys(answer, explanation)")
    .eq("quiz_id", quizId)
    .order("position");
  return (data ?? []).map((q) => {
    const key = (Array.isArray(q.quiz_question_keys) ? q.quiz_question_keys[0] : q.quiz_question_keys) as { answer: AnswerKey; explanation: string | null } | null;
    return {
      id: q.id as string,
      type: q.type as QuestionType,
      points: q.points as number,
      choices: q.choices,
      hint: q.hint as string | null,
      answer: (key?.answer ?? { correct: "__none__" }) as AnswerKey,
      explanation: key?.explanation ?? null,
    };
  });
}

/** Only the server writes results and scores. */
export async function writeAttempt(attemptId: string, patch: Partial<QuizAttempt>) {
  const admin = createAdminClient();
  return admin.from("quiz_attempts").update(patch).eq("id", attemptId).eq("status", "in_progress");
}
