import { getTranslations, setRequestLocale } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { Container, PageHeader } from "@/components/ui/Layout";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "meta" });
  return { title: t("book") };
}

/** "Book a Session" button target: logged-in parents go straight to booking. */
export default async function BookPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = Object.fromEntries(Object.entries(await searchParams).filter(([, v]) => v)) as Record<string, string>;
  const user = await getSessionUser();
  if (user?.role === "parent") redirect({ href: { pathname: "/dashboard/parent/book", query }, locale });
  if (user) redirect({ href: "/dashboard", locale });

  const t = await getTranslations("book");
  const ta = await getTranslations("auth");
  const next = `/dashboard/parent/book${Object.keys(query).length ? `?${new URLSearchParams(query)}` : ""}`;
  return (
    <>
      <PageHeader title={t("title")} intro={t("needAccount")} />
      <Container className="py-8">
        <p className="mb-6 text-lg">{t("whyAccount")}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/signup" size="lg">{ta("createAccount")}</ButtonLink>
          <ButtonLink href={{ pathname: "/login", query: { next } }} size="lg" variant="secondary">{ta("login")}</ButtonLink>
        </div>
      </Container>
    </>
  );
}
