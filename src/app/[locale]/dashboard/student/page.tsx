import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Layout";
import { requireStudent } from "@/lib/student-session";
import { loadOverview } from "@/lib/student-data";
import { formatDateTime, formatShortDate } from "@/lib/time";

/** Friendly student home: next session, work due, quizzes to take, badges and streak. No comparisons with other kids. */
export default async function StudentHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { student, supabase } = await requireStudent();
  const t = await getTranslations("student");
  const tp = await getTranslations("progress");
  const tb = await getTranslations("booking");
  const ts = await getTranslations("subjects");
  const [o] = await loadOverview(supabase, [student]);
  const next = o.upcoming[0];
  const due = o.assignments.filter((a) => !a.submission || a.submission.status === "returned");
  const quizzes = o.quizzes.filter((q) => q.best === null || q.inProgress);
  const lastNote = o.notes[0];
  return (
    <div>
      <h1 className="text-3xl font-extrabold">{t("hello", { name: student.nickname })} 👋</h1>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="bg-brand-soft">
          <h2 className="text-xl font-bold">📅 {t("nextSession")}</h2>
          {next ? (
            <>
              <p className="mt-2 text-lg font-semibold">{formatDateTime(next.starts_at, locale)}</p>
              <p>{ts.has(`names.${next.subject}`) ? ts(`names.${next.subject}`) : next.subject}</p>
              {next.mode === "online" && next.meeting_link ? (
                <a href={next.meeting_link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-12 items-center rounded-xl bg-leaf px-4 font-bold text-white no-underline hover:text-white">🎥 {tb("joinVideo")}</a>
              ) : null}
            </>
          ) : <p className="mt-2">{t("noSession")}</p>}
        </Card>

        <Card className="bg-sun-soft">
          <h2 className="text-xl font-bold">🏅 {t("progress")}</h2>
          <p className="mt-2 text-lg font-semibold">{o.streak > 0 ? `🔥 ${tp("streak", { count: o.streak })}` : t("startStreak")}</p>
          {o.badges.length ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {o.badges.map((b) => <li key={b.key} className="rounded-full bg-white px-3 py-1 font-semibold"><span aria-hidden="true">{b.icon} </span>{tp(`badges.${b.key}`)}</li>)}
            </ul>
          ) : <p className="mt-1">{t("firstBadge")}</p>}
        </Card>
      </div>

      <section className="mt-8" aria-labelledby="todo">
        <h2 id="todo" className="mb-3 text-2xl font-bold">📝 {t("assignmentsDue")}</h2>
        {due.length ? (
          <ul className="space-y-2">
            {due.slice(0, 5).map((a) => (
              <Card as="li" key={a.id} className="flex items-center justify-between gap-2">
                <Link href={`/dashboard/student/assignments/${a.id}`} className="text-lg font-bold">{a.title}</Link>
                {a.due_at ? <span className="text-muted">{formatShortDate(a.due_at, locale)}</span> : null}
              </Card>
            ))}
          </ul>
        ) : <EmptyState>{t("noAssignments")}</EmptyState>}
      </section>

      <section className="mt-8" aria-labelledby="quizzes">
        <h2 id="quizzes" className="mb-3 text-2xl font-bold">🧩 {t("quizzesToTake")}</h2>
        {quizzes.length ? (
          <ul className="space-y-2">
            {quizzes.map((q) => (
              <Card as="li" key={q.id} className="flex items-center justify-between gap-2">
                <span className="text-lg font-bold">{q.title}</span>
                <ButtonLink href="/dashboard/student/quizzes">{t("go")}</ButtonLink>
              </Card>
            ))}
          </ul>
        ) : <EmptyState>{t("noQuizzes")}</EmptyState>}
      </section>

      {lastNote ? (
        <section className="mt-8" aria-labelledby="note">
          <h2 id="note" className="mb-3 text-2xl font-bold">💬 {t("lastNote")}</h2>
          <Card>
            <p>{lastNote.worked_on}</p>
            {lastNote.practice ? <p className="mt-2"><strong>{tb("practice")}:</strong> {lastNote.practice}</p> : null}
          </Card>
        </section>
      ) : null}
    </div>
  );
}
