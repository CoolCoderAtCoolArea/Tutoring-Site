import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { Card, EmptyState, Tag } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";

async function markHelp(data: FormData) {
  "use server";
  const user = await requireUser(["tutor", "admin"]);
  const supabase = await createClient();
  await supabase.from("help_requests").update({ status: String(data.get("status")), handled_by: user.id }).eq("id", String(data.get("id")));
  revalidatePath("/", "layout");
}

/** Homework help requests from the public form. Tutors reply by email to the parent. */
export default async function HelpRequests({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireUser(["tutor", "admin"]);
  const t = await getTranslations("tutor");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const supabase = await createClient();
  const { data } = await supabase.from("help_requests").select("*").neq("status", "closed").order("created_at", { ascending: false }).limit(100);
  return (
    <div>
      <h1 className="text-3xl font-extrabold">{t("helpTitle")}</h1>
      <p className="mt-2 text-lg">{t("helpIntro")}</p>
      {!data?.length ? <EmptyState>{t("noHelp")}</EmptyState> : (
        <ul className="mt-6 space-y-4">
          {data.map((h) => (
            <Card as="li" key={h.id}>
              <p className="flex flex-wrap gap-2">
                <Tag>{ts.has(`names.${h.subject}`) ? ts(`names.${h.subject}`) : h.subject}</Tag>
                <Tag>{tc("gradeN", { grade: h.grade })}</Tag>
                <Tag className={h.status === "open" ? "bg-sun-soft" : "bg-leaf-soft"}>{t(`helpStatus.${h.status}`)}</Tag>
              </p>
              <p className="mt-2 font-bold">{h.student_name} · <span className="font-normal text-muted">{formatDateTime(h.created_at, locale)}</span></p>
              <p className="mt-1 whitespace-pre-line">{h.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 font-semibold text-white no-underline hover:text-white"
                  href={`mailto:${h.contact_email}?subject=${encodeURIComponent(t("helpReplySubject"))}`}>✉️ {t("replyByEmail")}</a>
                <form action={markHelp}>
                  <input type="hidden" name="id" value={h.id} />
                  <input type="hidden" name="status" value={h.status === "open" ? "answered" : "closed"} />
                  <Button type="submit" variant="secondary">{h.status === "open" ? t("markAnswered") : t("markClosed")}</Button>
                </form>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
