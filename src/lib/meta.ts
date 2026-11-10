import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { locales } from "@/i18n/config";

/** Title, description and language links for a public page. */
export async function pageMeta(locale: string, key: string, path: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "meta" });
  const href = (l: string) => (l === "en" ? path : `/${l}${path}`);
  return {
    title: t(key),
    description: t("siteDescription"),
    alternates: {
      canonical: href(locale),
      languages: Object.fromEntries(locales.map((l) => [l, href(l)])),
    },
    openGraph: { title: t(key), description: t("siteDescription") },
  };
}

export type PageProps = { params: Promise<{ locale: string }> };
