import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/config/site";
import { ButtonLink } from "@/components/ui/Button";
import { Card, PageHeader, Section } from "@/components/ui/Layout";
import { pageMeta, type PageProps } from "@/lib/meta";

export async function generateMetadata({ params }: PageProps) {
  return pageMeta((await params).locale, "subjects", "/subjects");
}

export default async function SubjectsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("subjects");
  const tm = await getTranslations("meta");
  const tc = await getTranslations("common");
  return (
    <>
      <PageHeader title={tm("subjects")} intro={tm("siteDescription")} />
      <Section>
        <ul className="grid gap-4 sm:grid-cols-2">
          {site.subjects.map((s) => (
            <Card as="li" key={s}>
              <h2 className="text-2xl font-bold">{t(`names.${s}`)}</h2>
              <p className="font-semibold text-muted">{t("gradesLabel", { grades: t(`grades.${s}`) })}</p>
              <p className="mt-2">{t(`blurbs.${s}`)}</p>
            </Card>
          ))}
        </ul>
      </Section>
      <Section title={t("sessionLooksLike")} id="session" className="bg-white">
        <ol className="max-w-2xl list-decimal space-y-2 ps-6 text-lg">
          {(t.raw("sessionSteps") as string[]).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <ButtonLink href="/book" size="lg" className="mt-6">
          {tc("bookSession")}
        </ButtonLink>
      </Section>
    </>
  );
}
