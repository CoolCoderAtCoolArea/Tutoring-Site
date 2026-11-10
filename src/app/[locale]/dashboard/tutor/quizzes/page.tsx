import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, EmptyState, Tag } from "@/components/ui/Layout";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { duplicateQuiz } from "@/lib/actions/quiz";

export default async function TutorQuizzes() {
  const user = await requireUser(["tutor", "admin"]);
  const t = await getTranslations("quiz");
  const ts = await getTranslations("subjects");
  const supabase = await createClient();
  const [{ data: mine }, { data: library }] = await Promise.all([
    supabase.from("quizzes").select("id, title, subject, grade_band, quiz_questions(count), quiz_assignments(count)").eq("tutor_id", user.id).order("created_at", { ascending: false }),
    supabase.from("quizzes").select("id, title, subject, grade_band, description, quiz_questions(count)").is("tutor_id", null).order("title"),
  ]);
  type Row = { id: string; title: string; subject: string; grade_band: string; description?: string; quiz_questions: { count: number }[]; quiz_assignments?: { count: number }[] };
  const subj = (s: string) => (ts.has(`names.${s}`) ? ts(`names.${s}`) : s);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{t("tutorTitle")}</h1>
        {user.role === "tutor" ? <ButtonLink href="/dashboard/tutor/quizzes/new">+ {t("new")}</ButtonLink> : null}
      </div>
      {user.role === "tutor" ? (
        <section className="mt-6" aria-labelledby="mine">
          <h2 id="mine" className="mb-3 text-2xl font-bold">{t("mine")}</h2>
          {!mine?.length ? <EmptyState>{t("noneYet")}</EmptyState> : (
            <ul className="space-y-3">
              {(mine as unknown as Row[]).map((q) => (
                <Card as="li" key={q.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link href={`/dashboard/tutor/quizzes/${q.id}`} className="text-lg font-bold">{q.title}</Link>
                    <p className="text-muted">{subj(q.subject)}{q.grade_band ? ` · ${q.grade_band}` : ""} · {t("questionCount", { count: q.quiz_questions[0]?.count ?? 0 })} · {t("assignedCount", { count: q.quiz_assignments?.[0]?.count ?? 0 })}</p>
                  </div>
                  <Link href={`/dashboard/tutor/quizzes/${q.id}/results`} className="inline-flex min-h-11 items-center font-semibold">{t("results")}</Link>
                </Card>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      <section className="mt-10" aria-labelledby="library">
        <h2 id="library" className="mb-1 text-2xl font-bold">{t("library")}</h2>
        <p className="mb-3 text-muted">{t("libraryIntro")}</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {((library ?? []) as unknown as Row[]).map((q) => (
            <Card as="li" key={q.id}>
              <p className="text-lg font-bold">{q.title}</p>
              <p className="mt-1 flex flex-wrap gap-1"><Tag>{subj(q.subject)}</Tag>{q.grade_band ? <Tag>{t("gradesTag", { grades: q.grade_band })}</Tag> : null}</p>
              <p className="mt-1 text-muted">{q.description} · {t("questionCount", { count: q.quiz_questions[0]?.count ?? 0 })}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {user.role === "tutor" ? (
                  <form action={duplicateQuiz}>
                    <input type="hidden" name="id" value={q.id} />
                    <Button type="submit" variant="secondary">{t("makeCopy")}</Button>
                  </form>
                ) : <ButtonLink href={`/dashboard/tutor/quizzes/${q.id}`} variant="secondary">{t("edit")}</ButtonLink>}
              </div>
            </Card>
          ))}
        </ul>
      </section>
    </div>
  );
}
