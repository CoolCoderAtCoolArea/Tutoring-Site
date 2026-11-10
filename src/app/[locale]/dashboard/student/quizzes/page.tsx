import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Layout";
import { requireStudent } from "@/lib/student-session";
import { loadOverview } from "@/lib/student-data";
import { startQuiz } from "@/lib/actions/quiz";
import { formatShortDate } from "@/lib/time";

export default async function StudentQuizzes({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string }> }) {
  const { locale } = await params;
  const { error } = await searchParams;
  const { student, supabase } = await requireStudent();
  const t = await getTranslations("quiz");
  const te = await getTranslations("errors");
  const [o] = await loadOverview(supabase, [student]);
  return (
    <div>
      <h1 className="text-3xl font-extrabold">{t("myQuizzes")}</h1>
      {error ? <Alert tone="error">{te.has(error) ? te(error) : te("generic")}</Alert> : null}
      {o.quizzes.length === 0 ? <div className="mt-6"><EmptyState>{t("noQuizzes")}</EmptyState></div> : (
        <ul className="mt-6 space-y-3">
          {o.quizzes.map((q) => {
            const last = q.attempts.find((a) => a.status === "submitted");
            const canStart = !last || q.allow_retries || q.inProgress;
            return (
              <Card as="li" key={q.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">{q.title}</p>
                  <p className="text-muted">
                    {q.best !== null ? t("best", { score: q.best }) : t("notTaken")}
                    {q.due_at ? ` · ${t("due", { date: formatShortDate(q.due_at, locale) })}` : ""}
                  </p>
                  {last ? <Link href={`/dashboard/results/${last.id}`} className="inline-flex min-h-11 items-center">{t("seeResults")}</Link> : null}
                </div>
                {canStart ? (
                  <form action={startQuiz}>
                    <input type="hidden" name="quiz_id" value={q.id} />
                    <input type="hidden" name="student_id" value={student.id} />
                    <Button type="submit" size="lg" variant={q.inProgress ? "accent" : "primary"}>
                      {q.inProgress ? t("keepGoing") : last ? t("tryAgain") : t("start")}
                    </Button>
                  </form>
                ) : null}
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
