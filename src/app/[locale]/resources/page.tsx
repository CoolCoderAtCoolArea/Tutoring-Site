import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/config/site";
import { Card, PageHeader, Section, Tag } from "@/components/ui/Layout";
import { getResources } from "@/lib/content";
import { pageMeta, type PageProps } from "@/lib/meta";

export const revalidate = 300;
export async function generateMetadata({ params }: PageProps) {
  return pageMeta((await params).locale, "resources", "/resources");
}

export default async function ResourcesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("resources");
  const ts = await getTranslations("subjects");
  const resources = await getResources(locale);
  // Group links by subject, in the site's subject order.
  const groups = site.subjects
    .map((s) => ({ subject: s, items: resources.filter((r) => r.subject === s) }))
    .filter((g) => g.items.length);
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      {groups.map((g) => (
        <Section key={g.subject} title={ts(`names.${g.subject}`)} id={`res-${g.subject}`}>
          <ul className="grid gap-4 sm:grid-cols-2">
            {g.items.map((r) => (
              <Card as="li" key={r.url}>
                <h3 className="text-xl font-bold">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center">
                    {r.title}
                    <span className="sr-only"> {t("external")}</span>
                    <span aria-hidden="true">&nbsp;↗</span>
                  </a>
                </h3>
                <Tag>{t("byGrade", { grades: r.grade_band })}</Tag>
                <p className="mt-2">{r.description}</p>
              </Card>
            ))}
          </ul>
        </Section>
      ))}
    </>
  );
}
