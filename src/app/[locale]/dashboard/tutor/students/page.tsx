import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, EmptyState, Tag } from "@/components/ui/Layout";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { gradeLabel } from "@/lib/labels";
import type { Student } from "@/lib/types";

/** Only students linked to this tutor are returned — enforced by Row Level Security. */
export default async function TutorStudents() {
  await requireUser(["tutor"]);
  const t = await getTranslations("tutor");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const supabase = await createClient();
  const { data } = await supabase.from("students").select("*").order("nickname");
  const students = (data ?? []) as Student[];
  return (
    <div>
      <h1 className="text-3xl font-extrabold">{t("studentsTitle")}</h1>
      <p className="mt-2 text-lg">{t("studentsIntro")}</p>
      {students.length === 0 ? <EmptyState>{t("noStudents")}</EmptyState> : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {students.map((s) => (
            <Card as="li" key={s.id}>
              <Link href={`/dashboard/tutor/students/${s.id}`} className="text-xl font-bold">{s.nickname}</Link>
              <p className="text-muted">{gradeLabel(tc, s.grade)}</p>
              <p className="mt-1 flex flex-wrap gap-1">{s.subjects.map((x) => <Tag key={x}>{ts(`names.${x}`)}</Tag>)}</p>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
