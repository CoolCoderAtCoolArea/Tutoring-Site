import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Layout";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <Container className="py-16 text-center">
      <p aria-hidden="true" className="text-6xl">🧭</p>
      <h1 className="mt-4 text-3xl font-extrabold">{t("title")}</h1>
      <p className="mt-3 text-lg text-muted">{t("body")}</p>
      <ButtonLink href="/" size="lg" className="mt-6">
        {t("home")}
      </ButtonLink>
    </Container>
  );
}
