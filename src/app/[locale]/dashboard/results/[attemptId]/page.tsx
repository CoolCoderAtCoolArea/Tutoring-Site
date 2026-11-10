import "katex/dist/katex.min.css";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Layout";
import { MathText } from "@/components/quiz/MathText";
import { requireUser } from "@/lib/auth";
import { loadKeys, loadOwnAttempt } from "@/lib/quiz/server";
import { describeAnswer } from "@/lib/quiz/grade";
import type { Response } from "@/lib/quiz/types";
import { formatDateTime } from "@/lib/time";

/** Results screen: score, what to review, and explanations. Kind words only. */
export default async function ResultsPage({ params }: { params: Promise<{ locale: string; attemptId: string }> }) {
  const { locale, attemptId } = await params;
  const user = await requireUser();
  const own = await loadOwnAttempt(attemptId); // RLS: student, their parent, the quiz's tutor, or admin
  if (!own || own.attempt.status !== "submitted") notFound();
  const t = await getTranslations("quiz.results");
  const tp = await getTranslations("quiz.player");
  const { attempt, quiz, supabase } = own;
  const isStaff = user.role === "tutor" || user.role === "admin";
  const showAnswers = quiz.show_answers || isStaff;
  const keys = await loadKeys(quiz.id);
  const { data: qs } = await supabase.from("quiz_questions").select("id, prompt, choices, type").eq("quiz_id", quiz.id).order("position");
  const pct = attempt.max_score ? Math.round((Number(attempt.score) / Number(attempt.max_score)) * 100) : 0;
  const results = attempt.results as Record<string, { correct: boolean }>;
  const review = (qs ?? []).filter((q) => !results[q.id]?.correct);
  const message = pct === 100 ? t("perfect") : pct >= 80 ? t("great") : pct >= 50 ? t("good") : t("keepGoing");

  const show = (q: { id: string; type: string; choices: unknown }, r: Response) => {
    if (r === undefined || r === null || r === "") return "—";
    const k = keys.find((x) => x.id === q.id)!;
    const list = Array.isArray(q.choices) ? (q.choices as { id: string; text: string }[]) : [];
    if (q.type === "multiple_choice") return list.find((c) => c.id === r)?.text ?? String(r);
    if (q.type === "multiple_select") return (r as string[]).map((id) => list.find((c) => c.id === id)?.text ?? id).join(", ");
    if (q.type === "true_false") return r === true || r === "true" ? tp("true") : tp("false");
    if (q.type === "fill_blank") return (r as string[]).join(", ");
    if (q.type === "matching") return describeAnswer("matching", { pairs: r as Record<string, string> }, q.choices, { true: "", false: "" });
    void k;
    return String(r);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="text-center">
        <p className="text-sm font-semibold text-muted">{quiz.title} · {formatDateTime(attempt.submitted_at!, locale)}</p>
        <p aria-hidden="true" className="mt-2 text-6xl">{pct === 100 ? "🌟" : pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "💪"}</p>
        <h1 className="mt-2 text-3xl font-extrabold">{message}</h1>
        <p className="mt-2 text-2xl font-bold">{t("score", { score: Number(attempt.score), max: Number(attempt.max_score), pct })}</p>
      </Card>

      <h2 className="mb-3 mt-8 text-2xl font-bold">{review.length ? t("toReview") : t("nothingToReview")}</h2>
      <ol className="space-y-4">
        {(qs ?? []).map((q, i) => {
          const ok = results[q.id]?.correct;
          const k = keys.find((x) => x.id === q.id)!;
          return (
            <li key={q.id}>
              <Card className={ok ? "border-leaf" : "border-coral"}>
                <p className="font-bold">
                  <span aria-hidden="true">{ok ? "✅ " : "🔁 "}</span>
                  {t("questionN", { n: i + 1 })} — <span>{ok ? t("correct") : t("review")}</span>
                </p>
                <MathText as="p" className="mt-1 text-lg" text={q.prompt} />
                <p className="mt-2"><strong>{t("yourAnswer")}:</strong> <MathText text={show(q, attempt.responses[q.id] as Response)} /></p>
                {showAnswers && !ok ? (
                  <p className="mt-1"><strong>{t("rightAnswer")}:</strong> <MathText text={describeAnswer(k.type, k.answer, q.choices, { true: tp("true"), false: tp("false") })} /></p>
                ) : null}
                {showAnswers && k.explanation ? <p className="mt-1 rounded-lg bg-sun-soft p-2"><strong>{t("why")}:</strong> <MathText text={k.explanation} /></p> : null}
              </Card>
            </li>
          );
        })}
      </ol>
      <p className="mt-6">
        <Link href={user.role === "student" ? "/dashboard/student/quizzes" : "/dashboard"} className="inline-flex min-h-11 items-center font-semibold">← {t("back")}</Link>
      </p>
    </div>
  );
}
