import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { QuizPlayer } from "@/components/quiz/QuizPlayer";
import { requireUser } from "@/lib/auth";
import { loadOwnAttempt } from "@/lib/quiz/server";
import { playerLabels } from "@/lib/quiz/labels";
import { localeTags } from "@/i18n/config";
import type { PublicQuestion } from "@/lib/quiz/types";

/** Taking a quiz. Students (or a parent sitting with a young child) only. */
export default async function QuizAttemptPage({ params }: { params: Promise<{ locale: string; attemptId: string }> }) {
  const { attemptId } = await params;
  await requireUser(["student", "parent"]);
  const own = await loadOwnAttempt(attemptId);
  if (!own) notFound();
  const locale = await getLocale();
  if (own.attempt.status === "submitted") redirect({ href: `/dashboard/results/${attemptId}`, locale });
  // Public question data only — the answer key is never sent to the browser.
  const { data: questions } = await own.supabase
    .from("quiz_questions").select("id, quiz_id, position, type, prompt, image_url, choices, hint, points").eq("quiz_id", own.quiz.id).order("position");
  if (!questions?.length) notFound();
  const results = Object.fromEntries(
    Object.entries(own.attempt.results as Record<string, { correct: boolean; final?: boolean }>).filter(([, r]) => r.final).map(([k, r]) => [k, { correct: r.correct, final: true }]),
  );
  return (
    <QuizPlayer
      attemptId={attemptId}
      title={own.quiz.title}
      questions={questions as PublicQuestion[]}
      initialResponses={own.attempt.responses as never}
      initialResults={results}
      initialIndex={own.attempt.current_index}
      instantFeedback={own.quiz.instant_feedback}
      timeLimitMinutes={own.quiz.time_limit_minutes}
      startedAt={own.attempt.started_at}
      speechLang={localeTags[locale] ?? locale}
      labels={await playerLabels()}
      resultsHref={`${locale === "en" ? "" : `/${locale}`}/dashboard/results/${attemptId}`}
    />
  );
}
