import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, Tag } from "@/components/ui/Layout";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { markMessageHandled, setApplicationStatus } from "@/lib/actions/admin";
import { formatDateTime } from "@/lib/time";

export default async function AdminInbox({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireUser(["admin"]);
  const t = await getTranslations("admin");
  const ts = await getTranslations("subjects");
  const supabase = await createClient();
  const [{ data: apps }, { data: msgs }] = await Promise.all([
    supabase.from("tutor_applications").select("*").in("status", ["new", "contacted"]).order("created_at", { ascending: false }),
    supabase.from("contact_messages").select("*").eq("handled", false).order("created_at", { ascending: false }),
  ]);
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-extrabold">{t("inboxTitle")}</h1>
      <p className="mt-2"><Link href="/dashboard/tutor/help" className="inline-flex min-h-11 items-center font-semibold">🙋 {t("helpLink")}</Link></p>

      <section className="mt-6" aria-labelledby="apps">
        <h2 id="apps" className="mb-1 text-2xl font-bold">{t("applications")}</h2>
        <p className="mb-3 text-muted">{t("applicationsIntro")}</p>
        {!apps?.length ? <EmptyState>{t("noData")}</EmptyState> : (
          <ul className="space-y-3">
            {apps.map((a) => (
              <Card as="li" key={a.id}>
                <p className="text-lg font-bold">{a.name} <Tag>{t(`appStatus.${a.status}`)}</Tag></p>
                <p className="text-sm text-muted">{formatDateTime(a.created_at, locale)} · <a href={`mailto:${a.email}`}>{a.email}</a></p>
                <p className="mt-1"><strong>{t("subjects")}:</strong> {a.subjects.map((s: string) => (ts.has(`names.${s}`) ? ts(`names.${s}`) : s)).join(", ")} · <strong>{t("gradeBand")}:</strong> {a.grades || "—"}</p>
                <p><strong>{t("when")}:</strong> {a.availability || "—"}</p>
                {a.why ? <p className="mt-1 whitespace-pre-line">{a.why}</p> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["contacted", "accepted", "declined"] as const).map((s) => (
                    <form key={s} action={setApplicationStatus}>
                      <input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value={s} />
                      <Button type="submit" variant="secondary" disabled={a.status === s}>{t(`appStatus.${s}`)}</Button>
                    </form>
                  ))}
                </div>
              </Card>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="msgs">
        <h2 id="msgs" className="mb-3 text-2xl font-bold">{t("messages")}</h2>
        {!msgs?.length ? <EmptyState>{t("noData")}</EmptyState> : (
          <ul className="space-y-3">
            {msgs.map((m) => (
              <Card as="li" key={m.id}>
                <p className="font-bold">{m.name} · <a href={`mailto:${m.email}`}>{m.email}</a></p>
                <p className="text-sm text-muted">{formatDateTime(m.created_at, locale)}</p>
                <p className="mt-1 whitespace-pre-line">{m.message}</p>
                <form action={markMessageHandled} className="mt-2"><input type="hidden" name="id" value={m.id} /><Button type="submit" variant="secondary">✓ {t("markHandled")}</Button></form>
              </Card>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
