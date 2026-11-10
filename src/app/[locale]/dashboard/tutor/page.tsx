import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Layout";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { detroitDateKey, formatDay, formatTime } from "@/lib/time";
import { formatLabel } from "@/lib/labels";
import type { Booking } from "@/lib/types";

export default async function TutorHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(["tutor"]);
  const t = await getTranslations("tutor");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const supabase = await createClient();
  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 86_400_000);
  const [{ data: sessions }, { count: toReview }, { count: help }, { count: needNotes }, { count: rules }] = await Promise.all([
    supabase.from("bookings").select("*, students(nickname, grade)").eq("tutor_id", user.id).eq("status", "booked")
      .gte("ends_at", now.toISOString()).lte("starts_at", weekOut.toISOString()).order("starts_at"),
    supabase.from("submissions").select("id, assignments!inner(tutor_id)", { count: "exact", head: true }).eq("assignments.tutor_id", user.id).eq("status", "submitted"),
    supabase.from("help_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("tutor_id", user.id).eq("status", "booked").lt("ends_at", now.toISOString()),
    supabase.from("availability_rules").select("id", { count: "exact", head: true }).eq("tutor_id", user.id),
  ]);
  const list = (sessions ?? []) as (Booking & { students: { nickname: string; grade: string } })[];
  const today = detroitDateKey(now);
  const todays = list.filter((b) => detroitDateKey(b.starts_at) === today);
  const later = list.filter((b) => detroitDateKey(b.starts_at) !== today);

  const row = (b: (typeof list)[number]) => (
    <Card as="li" key={b.id} className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-bold">{formatDay(b.starts_at, locale)} · {formatTime(b.starts_at, locale)}</p>
        <p>{b.students.nickname} ({tc("gradeN", { grade: b.students.grade })}) · {ts.has(`names.${b.subject}`) ? ts(`names.${b.subject}`) : b.subject}</p>
        <p className="text-sm text-muted">
          {formatLabel(tc, b.mode)}{b.is_intro ? ` · ${t("intro")}` : ""}{b.mode === "online" && !b.meeting_link ? ` · ⚠ ${t("needsLink")}` : ""}
        </p>
      </div>
      <ButtonLink href={`/dashboard/tutor/sessions/${b.id}`} variant="secondary">{t("open")}</ButtonLink>
    </Card>
  );

  return (
    <div>
      <h1 className="text-3xl font-extrabold">{t("homeTitle")}</h1>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        <li><Link href="/dashboard/tutor/assignments" className="block rounded-2xl bg-sun-soft p-4 text-ink no-underline"><span className="block text-3xl font-extrabold">{toReview ?? 0}</span>{t("toReview")}</Link></li>
        <li><Link href="/dashboard/tutor/help" className="block rounded-2xl bg-brand-soft p-4 text-ink no-underline"><span className="block text-3xl font-extrabold">{help ?? 0}</span>{t("openHelp")}</Link></li>
        <li><Link href="/dashboard/tutor/students" className="block rounded-2xl bg-leaf-soft p-4 text-ink no-underline"><span className="block text-3xl font-extrabold">{needNotes ?? 0}</span>{t("needNotes")}</Link></li>
      </ul>
      {!rules ? <Card className="mt-6"><p>{t("noHoursYet")}</p><ButtonLink href="/dashboard/tutor/availability" className="mt-3">{t("setHours")}</ButtonLink></Card> : null}

      <section className="mt-8" aria-labelledby="today">
        <h2 id="today" className="mb-3 text-2xl font-bold">{t("today")}</h2>
        {todays.length ? <ul className="space-y-3">{todays.map(row)}</ul> : <EmptyState>{t("nothingToday")}</EmptyState>}
      </section>
      <section className="mt-8" aria-labelledby="week">
        <h2 id="week" className="mb-3 text-2xl font-bold">{t("thisWeek")}</h2>
        {later.length ? <ul className="space-y-3">{later.map(row)}</ul> : <EmptyState>{t("nothingThisWeek")}</EmptyState>}
      </section>
    </div>
  );
}
