import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/public/LegalPage";
import { pageMeta, type PageProps } from "@/lib/meta";

export async function generateMetadata({ params }: PageProps) {
  return pageMeta((await params).locale, "privacy", "/privacy");
}

export default async function Page({ params }: PageProps) {
  setRequestLocale((await params).locale);
  return <LegalPage ns="privacy" draft={true} />;
}
