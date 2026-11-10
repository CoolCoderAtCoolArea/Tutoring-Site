import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/config/site";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { Container, PageHeader } from "@/components/ui/Layout";
import { pageMeta, type PageProps } from "@/lib/meta";

export async function generateMetadata({ params }: PageProps) {
  return pageMeta((await params).locale, "donate", "/donate");
}

export default async function DonatePage({ params }: PageProps) {
  setRequestLocale((await params).locale);
  const t = await getTranslations("donate");
  const tn = await getTranslations("nav");
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <Container className="py-8">
        {/* [PLACEHOLDER] No payment system yet. Add a link to a donation page (e.g. a fiscal sponsor) later. */}
        <Alert tone="info">
          {t("comingSoon")} <a href={`mailto:${site.email}`}>{site.email}</a>
        </Alert>
        <p className="text-lg">{t("otherWays")}</p>
        <ButtonLink href="/volunteer" className="mt-4">
          {tn("volunteer")}
        </ButtonLink>
      </Container>
    </>
  );
}
