import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, Section, EmptyState } from "@/components/ui/Layout";
import { TutorCard } from "@/components/public/TutorCard";
import { getPublicTutors } from "@/lib/content";
import { pageMeta, type PageProps } from "@/lib/meta";

export const revalidate = 300;
export async function generateMetadata({ params }: PageProps) {
  return pageMeta((await params).locale, "about", "/about");
}

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const tutors = await getPublicTutors();
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <Section title={t("storyTitle")} id="story">
        {(t.raw("story") as string[]).map((p) => (
          <p key={p} className="mb-3 max-w-3xl text-lg">{p}</p>
        ))}
        <h2 className="mb-3 mt-8 text-2xl font-bold">{t("whyTitle")}</h2>
        <ul className="max-w-3xl space-y-2">
          {(t.raw("why") as string[]).map((p) => (
            <li key={p} className="flex gap-2 text-lg">
              <span aria-hidden="true">💛</span> {p}
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t("tutorsTitle")} id="tutors" className="bg-white">
        {tutors.length ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {tutors.map((tutor) => (
              <TutorCard key={tutor.tutor_id} tutor={tutor} />
            ))}
          </ul>
        ) : (
          <EmptyState>{t("noTutors")}</EmptyState>
        )}
      </Section>
    </>
  );
}
