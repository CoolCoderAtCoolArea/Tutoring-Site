import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, EmptyState } from "@/components/ui/Layout";
import { requireStudent } from "@/lib/student-session";
import { loadOverview } from "@/lib/student-data";
import { formatShortDate } from "@/lib/time";

/** Simple to-do list: "To do" first (soonest due at top), then "Done". */
export default async function StudentAssignments({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { student, supabase } = await requireStudent();
  const t = await getTranslations("assign");
  const tp = await getTranslations("parent");
  const [o] = await loadOverview(supabase, [student]);
  const todo = o.assignments.filter((a) => !a.submission || a.submission.status === "returned");
  const done = o.assignments.filter((a) => a.submission && a.submission.status !== "returned");
  const item = (a: (typeof todo)[number]) => (
    <Card as="li" key={a.id} className="flex items-center justify-between gap-3">
      <div>
        <Link href={`/dashboard/student/assignments/${a.id}`} className="text-lg font-bold">{a.title}</Link>
        <p className="text-muted">
          {tp(`assignmentStatus.${a.submission?.status ?? "todo"}`)}
          {a.due_at ? ` · ${tp("due", { date: formatShortDate(a.due_at, locale) })}` : ""}
        </p>
      </div>
      <span aria-hidden="true" className="text-3xl">{a.submission?.sticker ?? (a.submission ? "✅" : "📝")}</span>
    </Card>
  );
  return (
    <div>
      <h1 className="text-3xl font-extrabold">{t("myAssignments")}</h1>
      <h2 className="mb-3 mt-6 text-2xl font-bold">{t("dueSoon")}</h2>
      {todo.length ? <ul className="space-y-3">{todo.map(item)}</ul> : <EmptyState>{t("allDone")}</EmptyState>}
      <h2 className="mb-3 mt-8 text-2xl font-bold">{t("done")}</h2>
      {done.length ? <ul className="space-y-3">{done.map(item)}</ul> : <EmptyState>{t("noneDone")}</EmptyState>}
    </div>
  );
}
