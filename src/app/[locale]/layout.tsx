import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { dirFor } from "@/i18n/config";
import { site, siteUrl } from "@/config/site";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { readableInitScript } from "@/components/layout/ReadableToggle";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4ed8",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${site.name} — ${t("home")}`, template: `%s | ${site.name}` },
    description: t("siteDescription"),
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: locale === "es" ? "es_US" : "en_US",
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: site.name }],
    },
    icons: { icon: "/icon.svg" },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("common");

  return (
    <html lang={locale} dir={dirFor(locale)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: readableInitScript }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only z-50 bg-sun p-3 font-bold text-ink focus:not-sr-only focus:absolute focus:start-2 focus:top-2"
        >
          {t("skipToContent")}
        </a>
        {/* Client components get their text as props, so no translations are shipped to the browser (saves data). */}
        <NextIntlClientProvider messages={{}}>
          <AnnouncementBanner locale={locale} />
          <Header />
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
