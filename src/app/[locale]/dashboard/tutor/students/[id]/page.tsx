import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Card, EmptyState } from "@/components/ui/Layout";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadOverview } from "@/lib/student-data";
import { formatDateTime, formatShortDate } from "@/lib/time";
import { gradeLabel } from "@/lib/labels";
import type { Student } from "@/lib/types";

export default async function TutorStudentDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requireUser(["tutor"]);
  const t = await getTranslations("tutor");
  const tp = await getTranslations("parent");
  const tb = await getTranslations("booking");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const supabase = await createClient();
  // If this student isn't assigned to this tutor, RLS returns nothing -> 404.
  const { data } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const [o] = await loadOverview(supabase, [data as Student]);
  const subj = (s: string) => (ts.has(`names.${s}`) ? ts(`names.${s}`) : s);
  const sessions = [...o.upcoming, ...o.past];
  return (
    <div>
      <h1 className="text-3xl font-extrabold">{o.student.nickname}</h1>
      <p className="text-lg text-muted">{gradeLabel(tc, o.student.grade)} · {o.student.subjects.map(subj).join(", ")}</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-xl font-bold">{t("sessions")}</h2>
          {sessions.length === 0 ? <EmptyState>{t("noSessions")}</EmptyState> : (
            <ul className="space-y-2">
              {sessions.map((b) => (
                <li key={b.id}>
                  {b.tutor_id ? <Link href={`/dashboard/tutor/sessions/${b.id}`}>{formatDateTime(b.starts_at, locale)}</Link> : null} · {subj(b.subject)} · {tb(`statuses.${b.status}`)}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 text-xl font-bold">{tp("notes")}</h2>
          {o.notes.length === 0 ? <p className="text-muted">{tp("noNotes")}</p> : (
            <ul className="space-y-2">{o.notes.map((n) => <li key={n.id}><span className="text-sm text-muted">{n.starts_at ? formatShortDate(n.starts_at, locale) : ""}</span> {n.worked_on}</li>)}</ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 text-xl font-bold">{tp("assignments")}</h2>
          {o.assignments.length === 0 ? <p className="text-muted">{tp("noAssignments")}</p> : (
            <ul className="space-y-2">{o.assignments.map((a) => <li key={a.id}><Link href={`/dashboard/tutor/assignments/${a.id}`}>{a.title}</Link> · {tp(`assignmentStatus.${a.submission?.status ?? "todo"}`)}</li>)}</ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 text-xl font-bold">{tp("quizzes")}</h2>
          {o.quizzes.length === 0 ? <p className="text-muted">{tp("noQuizzes")}</p> : (
            <ul className="space-y-2">{o.quizzes.map((q) => <li key={q.id}>{q.title} · {q.best !== null ? tp("bestScore", { score: q.best }) : tp("quizNotStarted")}</li>)}</ul>
          )}
        </Card>
      </div>
    </div>
  );
}
