import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Layout";
import { BarList } from "@/components/dashboard/BarList";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/time";
import { weekKey } from "@/lib/progress";

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireUser(["admin"]);
  const t = await getTranslations("admin");
  const ts = await getTranslations("subjects");
  const supabase = await createClient();
  const since = new Date(Date.now() - 8 * 7 * 86_400_000).toISOString();
  const month = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: bookings }, { count: pending }, { count: apps }, { count: msgs }, { count: families }, { data: attempts }] = await Promise.all([
    supabase.from("bookings").select("starts_at, subject, status, student_id").gte("starts_at", since),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "tutor").eq("approved", false),
    supabase.from("tutor_applications").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("handled", false),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "parent"),
    supabase.from("quiz_attempts").select("student_id").gte("started_at", month),
  ]);
  const live = (bookings ?? []).filter((b) => b.status !== "cancelled");
  // Sessions per week (last 8 weeks + this week)
  const weeks = new Map<string, number>();
  for (let i = 8; i >= 0; i--) weeks.set(weekKey(new Date(Date.now() - i * 7 * 86_400_000)), 0);
  for (const b of live) { const k = weekKey(b.starts_at); if (weeks.has(k)) weeks.set(k, weeks.get(k)! + 1); }
  // Subjects in demand
  const subjects = new Map<string, number>();
  for (const b of live) subjects.set(b.subject, (subjects.get(b.subject) ?? 0) + 1);
  // Active students: had a session or took a quiz in the last 30 days
  const active = new Set([...live.filter((b) => b.starts_at >= month).map((b) => b.student_id), ...(attempts ?? []).map((a) => a.student_id)]);

  const tiles = [
    { n: active.size, label: t("activeStudents"), href: "/dashboard/admin/users" },
    { n: families ?? 0, label: t("families"), href: "/dashboard/admin/users?role=parent" },
    { n: pending ?? 0, label: t("pendingTutors"), href: "/dashboard/admin/users?role=tutor" },
    { n: (apps ?? 0) + (msgs ?? 0), label: t("newInbox"), href: "/dashboard/admin/inbox" },
  ];
  return (
    <div>
      <h1 className="text-3xl font-extrabold">{t("homeTitle")}</h1>
      <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((x) => (
          <li key={x.label}><Link href={x.href} className="block rounded-2xl bg-white p-4 text-ink no-underline shadow-sm"><span className="block text-3xl font-extrabold">{x.n}</span>{x.label}</Link></li>
        ))}
      </ul>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-xl font-bold">{t("sessionsPerWeek")}</h2>
          <BarList label={t("sessionsPerWeek")} items={[...weeks.entries()].map(([k, v]) => ({ label: t("weekOf", { date: formatShortDate(k + "T12:00:00Z", locale) }), value: v }))} />
        </Card>
        <Card>
          <h2 className="mb-3 text-xl font-bold">{t("subjectsDemand")}</h2>
          {subjects.size ? <BarList label={t("subjectsDemand")} items={[...subjects.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: ts.has(`names.${k}`) ? ts(`names.${k}`) : k, value: v }))} /> : <p className="text-muted">{t("noData")}</p>}
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="text-xl font-bold">{t("export")}</h2>
        <p className="mb-2 text-muted">{t("exportIntro")}</p>
        <ul className="flex flex-wrap gap-2">
          {["bookings", "users", "students", "applications", "quiz_attempts"].map((x) => (
            <li key={x}><a href={`/api/admin/export?type=${x}`} className="inline-flex min-h-11 items-center rounded-lg border-2 border-brand px-3 font-semibold no-underline">⬇️ {t(`exports.${x}`)}</a></li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
