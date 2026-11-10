import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card, EmptyState, Tag } from "@/components/ui/Layout";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadOverview } from "@/lib/student-data";
import { startQuiz } from "@/lib/actions/quiz";
import { formatDateTime, formatShortDate } from "@/lib/time";
import { formatLabel, gradeLabel } from "@/lib/labels";
import type { Student } from "@/lib/types";

export default async function ParentHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(["parent"]);
  const t = await getTranslations("parent");
  const tb = await getTranslations("booking");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const tp = await getTranslations("progress");
  const supabase = await createClient();
  const { data } = await supabase.from("students").select("*").eq("parent_id", user.id).order("created_at");
  const overview = await loadOverview(supabase, (data ?? []) as Student[]);
  const { data: tutors } = await supabase.from("tutor_profiles").select("tutor_id, public_name");
  const tutorName = (id: string) => tutors?.find((x) => x.tutor_id === id)?.public_name ?? "";
  const subj = (s: string) => (ts.has(`names.${s}`) ? ts(`names.${s}`) : s);
  const upcoming = overview.flatMap((o) => o.upcoming.map((b) => ({ ...b, nickname: o.student.nickname }))).sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{t("homeTitle")}</h1>
        <ButtonLink href="/dashboard/parent/book" size="lg">{tc("bookSession")}</ButtonLink>
      </div>

      {overview.length === 0 ? (
        <Card className="mt-6">
          <h2 className="text-xl font-bold">{t("welcomeTitle")}</h2>
          <p className="mt-2">{t("welcomeBody")}</p>
          <ButtonLink href="/dashboard/parent/children" className="mt-4">{t("addChild")}</ButtonLink>
        </Card>
      ) : null}

      <section className="mt-8" aria-labelledby="upcoming">
        <h2 id="upcoming" className="mb-3 text-2xl font-bold">{t("upcoming")}</h2>
        {upcoming.length === 0 ? (
          <EmptyState>{t("noUpcoming")}</EmptyState>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((b) => (
              <Card as="li" key={b.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">{formatDateTime(b.starts_at, locale)}</p>
                  <p>{b.nickname} · {subj(b.subject)} · {tb("withTutor", { tutor: tutorName(b.tutor_id) })}</p>
                  <p className="text-muted">{formatLabel(tc, b.mode)}{b.mode === "online" && b.meeting_link ? ` · ${tb("linkReady")}` : ""}</p>
                </div>
                <ButtonLink href={`/dashboard/parent/sessions/${b.id}`} variant="secondary">{t("details")}</ButtonLink>
              </Card>
            ))}
          </ul>
        )}
      </section>

      {overview.map((o) => (
        <section key={o.student.id} className="mt-10" aria-labelledby={`kid-${o.student.id}`}>
          <h2 id={`kid-${o.student.id}`} className="text-2xl font-bold">
            {o.student.nickname} <span className="text-lg font-normal text-muted">· {gradeLabel(tc, o.student.grade)}</span>
          </h2>
          <p className="mt-1">
            {o.streak > 0 ? <Tag className="me-2">🔥 {tp("streak", { count: o.streak })}</Tag> : null}
            {o.badges.map((b) => <Tag key={b.key} className="me-2 bg-sun-soft">{b.icon} {tp(`badges.${b.key}`)}</Tag>)}
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card>
              <h3 className="text-lg font-bold">{t("notes")}</h3>
              {o.notes.length === 0 ? <p className="text-muted">{t("noNotes")}</p> : (
                <ul className="mt-2 space-y-3">
                  {o.notes.slice(0, 3).map((n) => (
                    <li key={n.id} className="border-b border-line pb-2">
                      <p className="text-sm font-semibold text-muted">{n.starts_at ? formatShortDate(n.starts_at, locale) : ""} · {subj(n.subject ?? "")}</p>
                      <p>{n.worked_on}</p>
                      {n.practice ? <p className="text-sm"><strong>{tb("practice")}:</strong> {n.practice}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h3 className="text-lg font-bold">{t("assignments")}</h3>
              {o.assignments.length === 0 ? <p className="text-muted">{t("noAssignments")}</p> : (
                <ul className="mt-2 space-y-2">
                  {o.assignments.slice(0, 6).map((a) => (
                    <li key={a.id}>
                      <Link href={`/dashboard/parent/assignments/${a.id}?student=${o.student.id}`} className="font-semibold">{a.title}</Link>
                      <p className="text-sm text-muted">{t(`assignmentStatus.${a.submission?.status ?? "todo"}`)}{a.due_at ? ` · ${t("due", { date: formatShortDate(a.due_at, locale) })}` : ""}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h3 className="text-lg font-bold">{t("quizzes")}</h3>
              {o.quizzes.length === 0 ? <p className="text-muted">{t("noQuizzes")}</p> : (
                <ul className="mt-2 space-y-2">
                  {o.quizzes.map((q) => (
                    <li key={q.id}>
                      <p className="font-semibold">{q.title}</p>
                      <p className="text-sm text-muted">
                        {q.best !== null ? t("bestScore", { score: q.best }) : q.inProgress ? t("quizStarted") : t("quizNotStarted")}
                        {q.attempts.filter((a) => a.status === "submitted").map((a) => (
                          <Link key={a.id} href={`/dashboard/results/${a.id}`} className="ms-2 inline-flex min-h-11 items-center">{t("seeResults")}</Link>
                        )).slice(0, 1)}
                      </p>
                      {/* For young kids without their own login: take the quiz together on the parent's phone. */}
                      {q.inProgress || q.best === null || q.allow_retries ? (
                        <form action={startQuiz}>
                          <input type="hidden" name="quiz_id" value={q.id} />
                          <input type="hidden" name="student_id" value={o.student.id} />
                          <button type="submit" className="inline-flex min-h-11 items-center font-semibold text-brand underline">{t("takeTogether")}</button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {o.past.length ? (
            <details className="mt-4">
              <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand underline">{t("pastSessions", { count: o.past.length })}</summary>
              <ul className="mt-2 space-y-1">
                {o.past.slice(0, 20).map((b) => (
                  <li key={b.id}>
                    <Link href={`/dashboard/parent/sessions/${b.id}`}>{formatDateTime(b.starts_at, locale)}</Link> · {subj(b.subject)} · {tb(`statuses.${b.status}`)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ))}
    </div>
  );
}
