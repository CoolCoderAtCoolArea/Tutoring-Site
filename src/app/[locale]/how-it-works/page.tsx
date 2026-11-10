import { getTranslations, setRequestLocale } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader, Section } from "@/components/ui/Layout";
import { FaqList } from "@/components/public/FaqList";
import { getFaqs } from "@/lib/content";
import { pageMeta, type PageProps } from "@/lib/meta";

export const revalidate = 300;
export async function generateMetadata({ params }: PageProps) {
  return pageMeta((await params).locale, "how", "/how-it-works");
}

export default async function HowPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("how");
  const th = await getTranslations("home");
  const tc = await getTranslations("common");
  const faqs = await getFaqs(locale, t.raw("faq") as { q: string; a: string }[]);
  const steps = th.raw("steps") as { title: string; body: string }[];
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <Section>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="rounded-2xl bg-brand-soft p-5">
              <p className="text-lg font-bold">
                {i + 1}. {step.title}
              </p>
              <p className="mt-1">{step.body}</p>
            </li>
          ))}
        </ol>
        <ButtonLink href="/book" size="lg" className="mt-6">
          {tc("bookSession")}
        </ButtonLink>
      </Section>
      <Section title={t("faqTitle")} id="faq" className="bg-white">
        <FaqList items={faqs} />
      </Section>
    </>
  );
}
