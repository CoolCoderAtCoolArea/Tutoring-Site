import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { site, siteUrl } from "@/config/site";
import { ButtonLink } from "@/components/ui/Button";
import { Card, Container, Section } from "@/components/ui/Layout";
import { TutorCard } from "@/components/public/TutorCard";
import { FaqList } from "@/components/public/FaqList";
import { getFaqs, getPublicTutors, getTestimonials } from "@/lib/content";

export const revalidate = 300; // refresh content from the database every 5 minutes

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: { absolute: `${site.name} — ${t("home")}` },
    alternates: { canonical: locale === "en" ? "/" : `/${locale}`, languages: { en: "/", es: "/es" } },
  };
}

const subjectIcons: Record<string, string> = { math: "➗", reading: "📖", writing: "✏️", science: "🔬", homework: "📝", testprep: "🎯" };

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const tt = await getTranslations("testimonials");
  const th = await getTranslations("how");

  const [tutors, testimonials, faqs] = await Promise.all([
    getPublicTutors(),
    getTestimonials(locale),
    getFaqs(locale, th.raw("faq") as { q: string; a: string }[], true),
  ]);
  const steps = t.raw("steps") as { title: string; body: string }[];

  // Structured data so search engines know we're a free tutoring program in Detroit.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["EducationalOrganization", "LocalBusiness"],
    name: site.name,
    url: siteUrl(),
    email: site.email,
    description: t("sub"),
    areaServed: { "@type": "City", name: "Detroit, MI" },
    address: { "@type": "PostalAddress", addressLocality: "Detroit", addressRegion: "MI", addressCountry: "US" },
    priceRange: "Free",
    knowsLanguage: ["en", "es"],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO — headline + main button visible without scrolling on a 360px phone */}
      <div className="bg-sun-soft">
        <Container className="py-8 sm:py-14">
          <p className="inline-block rounded-full bg-sun px-3 py-1 font-bold">{t("eyebrow")}</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-5xl">{t("headline")}</h1>
          <p className="mt-3 max-w-2xl text-lg sm:text-xl">{t("sub")}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/book" size="lg">
              {tc("bookSession")} <span aria-hidden="true">→</span>
            </ButtonLink>
            <ButtonLink href="/availability" size="lg" variant="secondary">
              {t("ctaSecondary")}
            </ButtonLink>
          </div>
          <p className="mt-4">
            <Link href="/book?intro=1" className="inline-flex min-h-11 items-center font-semibold">
              {t("introCta")}
            </Link>
          </p>
        </Container>
      </div>

      <Section title={t("atAGlance")} id="subjects">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {site.subjects.map((s) => (
            <li key={s}>
              <Link href="/subjects" className="flex min-h-full flex-col rounded-2xl border border-line bg-white p-4 text-ink no-underline hover:border-brand">
                <span aria-hidden="true" className="text-3xl">{subjectIcons[s]}</span>
                <span className="mt-1 text-lg font-bold">{ts(`names.${s}`)}</span>
                <span className="text-muted">{ts("gradesLabel", { grades: ts(`grades.${s}`) })}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("howTitle")} id="how" className="bg-white">
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="rounded-2xl bg-brand-soft p-5">
              <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
                {i + 1}
              </span>
              <h3 className="mt-3 text-xl font-bold">{step.title}</h3>
              <p className="mt-1">{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t("tutorsTitle")} id="tutors">
        <ul className="grid gap-4 sm:grid-cols-2">
          {tutors.slice(0, 2).map((tutor) => (
            <TutorCard key={tutor.tutor_id} tutor={tutor} compact />
          ))}
        </ul>
        <p className="mt-4">
          <Link href="/about" className="inline-flex min-h-11 items-center font-semibold">
            {t("allTutors")} <span aria-hidden="true">&nbsp;→</span>
          </Link>
        </p>
      </Section>

      <Section title={t("testimonialsTitle")} id="testimonials" className="bg-white">
        {testimonials.some((x) => x.is_placeholder) ? <p className="mb-4 text-sm text-muted">{tt("placeholderNote")}</p> : null}
        <ul className="grid gap-4 sm:grid-cols-2">
          {testimonials.map((x) => (
            <Card as="li" key={x.quote}>
              <figure>
                <blockquote className="text-lg">“{x.quote}”</blockquote>
                <figcaption className="mt-2 font-semibold text-muted">— {x.attribution}</figcaption>
              </figure>
            </Card>
          ))}
        </ul>
      </Section>

      <Section title={t("safetyTitle")} id="safety">
        <div className="rounded-2xl border-4 border-leaf bg-leaf-soft p-5">
          <p className="text-lg">
            <span aria-hidden="true">🛡️ </span>
            {t("safetyBody")}
          </p>
          <Link href="/child-safety" className="mt-2 inline-flex min-h-11 items-center font-semibold">
            {t("safetyLink")}
          </Link>
        </div>
      </Section>

      <Section title={t("faqTitle")} id="faq" className="bg-white">
        <FaqList items={faqs} />
        <p className="mt-4">
          <Link href="/how-it-works" className="inline-flex min-h-11 items-center font-semibold">
            {t("allFaq")}
          </Link>
        </p>
      </Section>
    </>
  );
}
