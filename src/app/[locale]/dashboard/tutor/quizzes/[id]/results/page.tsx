import "katex/dist/katex.min.css";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Card, EmptyState } from "@/components/ui/Layout";
import { MathText } from "@/components/quiz/MathText";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/time";

/** Tutor view: each student's scores over time, and which questions are missed most. */
export default async function QuizResults({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requireUser(["tutor", "admin"]);
  const t = await getTranslations("quiz");
  const supabase = await createClient();
  const { data: quiz } = await supabase.from("quizzes").select("id, title").eq("id", id).maybeSingle();
  if (!quiz) notFound();
  const [{ data: attempts }, { data: questions }] = await Promise.all([
    supabase.from("quiz_attempts").select("id, student_id, score, max_score, submitted_at, results, students(nickname)").eq("quiz_id", id).eq("status", "submitted").order("submitted_at"),
    supabase.from("quiz_questions").select("id, prompt, position").eq("quiz_id", id).order("position"),
  ]);
  type A = { id: string; student_id: string; score: number; max_score: number; submitted_at: string; results: Record<string, { correct: boolean }>; students: { nickname: string } };
  const list = (attempts ?? []) as unknown as A[];
  const byStudent = new Map<string, A[]>();
  for (const a of list) byStudent.set(a.student_id, [...(byStudent.get(a.student_id) ?? []), a]);
  const stats = (questions ?? []).map((q) => {
    const answered = list.filter((a) => a.results[q.id]);
    const right = answered.filter((a) => a.results[q.id].correct).length;
    return { ...q, total: answered.length, pct: answered.length ? Math.round((right / answered.length) * 100) : null };
  }).sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
  const pct = (a: A) => (a.max_score ? Math.round((a.score / a.max_score) * 100) : 0);

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-extrabold">{t("resultsFor", { title: quiz.title })}</h1>
      {list.length === 0 ? <div className="mt-6"><EmptyState>{t("noResults")}</EmptyState></div> : (
        <>
          <h2 className="mb-3 mt-8 text-2xl font-bold">{t("byStudent")}</h2>
          <ul className="space-y-3">
            {[...byStudent.values()].map((as) => (
              <Card as="li" key={as[0].student_id}>
                <p className="text-lg font-bold">{as[0].students.nickname}</p>
                <ol className="mt-2 flex flex-wrap gap-2">
                  {as.map((a) => (
                    <li key={a.id}><Link href={`/dashboard/results/${a.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-brand-soft px-3 no-underline">{formatShortDate(a.submitted_at, locale)}: <strong className="ms-1">{pct(a)}%</strong></Link></li>
                  ))}
                </ol>
              </Card>
            ))}
          </ul>
          <h2 className="mb-1 mt-8 text-2xl font-bold">{t("byQuestion")}</h2>
          <p className="mb-3 text-muted">{t("byQuestionIntro")}</p>
          <table className="w-full border-collapse bg-white text-start">
            <caption className="sr-only">{t("byQuestion")}</caption>
            <thead><tr className="border-b-2 border-ink"><th scope="col" className="p-2 text-start">{t("question")}</th><th scope="col" className="p-2 text-end">{t("percentRight")}</th></tr></thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.id} className="border-b border-line">
                  <td className="p-2">{s.position}. <MathText text={s.prompt.length > 120 ? s.prompt.slice(0, 120) + "…" : s.prompt} /></td>
                  <td className="p-2 text-end font-bold">{s.pct === null ? "—" : `${s.pct}%`} {s.pct !== null && s.pct < 50 ? <span>⚠️<span className="sr-only">{t("oftenMissed")}</span></span> : null}<span className="block text-sm font-normal text-muted">{t("answers", { count: s.total })}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
