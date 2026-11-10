import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card, EmptyState, Tag } from "@/components/ui/Layout";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/time";

export default async function TutorAssignments({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(["tutor"]);
  const t = await getTranslations("assign");
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignments")
    .select("id, title, due_at, created_at, assignment_students(count), submissions(status)")
    .eq("tutor_id", user.id)
    .order("created_at", { ascending: false });
  type Row = { id: string; title: string; due_at: string | null; assignment_students: { count: number }[]; submissions: { status: string }[] };
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{t("tutorTitle")}</h1>
        <ButtonLink href="/dashboard/tutor/assignments/new">+ {t("new")}</ButtonLink>
      </div>
      {rows.length === 0 ? <div className="mt-6"><EmptyState>{t("noneYet")}</EmptyState></div> : (
        <ul className="mt-6 space-y-3">
          {rows.map((a) => {
            const toReview = a.submissions.filter((s) => s.status === "submitted").length;
            return (
              <Card as="li" key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link href={`/dashboard/tutor/assignments/${a.id}`} className="text-lg font-bold">{a.title}</Link>
                  <p className="text-muted">
                    {t("turnedInCount", { done: a.submissions.length, total: a.assignment_students[0]?.count ?? 0 })}
                    {a.due_at ? ` · ${t("dueShort", { date: formatShortDate(a.due_at, locale) })}` : ""}
                  </p>
                </div>
                {toReview ? <Tag className="bg-sun-soft">{t("toReview", { count: toReview })}</Tag> : null}
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
