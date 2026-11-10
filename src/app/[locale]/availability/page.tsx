import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Container, EmptyState, PageHeader } from "@/components/ui/Layout";
import { getOpenSlots } from "@/lib/slots";
import { detroitDateKey, formatDay, formatTime } from "@/lib/time";
import { gradeOptions, subjectOptions } from "@/lib/options";
import { formatLabel } from "@/lib/labels";
import { pageMeta } from "@/lib/meta";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ subject?: string; grade?: string; mode?: string }>;
};

export async function generateMetadata({ params }: Props) {
  return pageMeta((await params).locale, "availability", "/availability");
}

/**
 * Public, read-only weekly calendar. Shows ONLY tutor name, time, subjects and
 * format — never any student information. Filters use a plain GET form so they
 * work even without JavaScript.
 */
export default async function AvailabilityPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const filters = await searchParams;
  const t = await getTranslations("availability");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const slots = await getOpenSlots(filters);

  // Group by Detroit calendar day.
  const days = new Map<string, NonNullable<typeof slots>>();
  for (const s of slots ?? []) {
    const key = detroitDateKey(s.starts_at);
    days.set(key, [...(days.get(key) ?? []), s]);
  }

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <Container className="py-6">
        <form method="get" className="rounded-2xl border border-line bg-white p-4" aria-label={t("filters")}>
          <div className="grid gap-x-4 sm:grid-cols-3">
            <Select label={tc("subject")} name="subject" defaultValue={filters.subject ?? ""} options={subjectOptions(ts)} placeholder={tc("allSubjects")} />
            <Select label={tc("grade")} name="grade" defaultValue={filters.grade ?? ""} options={gradeOptions(tc)} placeholder={tc("allGrades")} />
            <Select
              label={tc("both")}
              name="mode"
              defaultValue={filters.mode ?? ""}
              options={[
                { value: "in_person", label: tc("inPerson") },
                { value: "online", label: tc("online") },
              ]}
              placeholder={tc("anyFormat")}
            />
          </div>
          <Button type="submit" variant="secondary">
            {t("apply")}
          </Button>
        </form>
        <p className="mt-4 text-muted">{tc("detroitTime")}</p>

        {slots === null ? (
          <Alert tone="info">{t("notSetup")}</Alert>
        ) : days.size === 0 ? (
          <div className="mt-4">
            <EmptyState>{t("none")}</EmptyState>
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {[...days.entries()].map(([key, list]) => (
              <section key={key} aria-labelledby={`day-${key}`}>
                <h2 id={`day-${key}`} className="mb-2 text-xl font-bold">
                  {formatDay(list[0].starts_at, locale)}
                </h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {list.map((s) => {
                    const time = formatTime(s.starts_at, locale);
                    return (
                      <li key={`${s.tutor_id}-${s.starts_at}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-3">
                        <div>
                          <p className="font-bold">
                            {time}–{formatTime(s.ends_at, locale)}
                          </p>
                          <p>{t("with", { tutor: s.tutor_name })}</p>
                          <p className="text-sm text-muted">
                            {s.subjects.map((x) => (ts.has(`names.${x}`) ? ts(`names.${x}`) : x)).join(", ")} ·{" "}
                            {s.modes.map((m) => formatLabel(tc, m)).join(" / ")}
                          </p>
                        </div>
                        <Link
                          href={{ pathname: "/book", query: { tutor: s.tutor_id, start: s.starts_at, subject: filters.subject ?? "" } }}
                          aria-label={t("bookTime", { time: `${formatDay(s.starts_at, locale)} ${time}`, tutor: s.tutor_name })}
                          className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-brand px-4 font-semibold text-white no-underline hover:bg-brand-dark hover:text-white"
                        >
                          {t("book")}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
