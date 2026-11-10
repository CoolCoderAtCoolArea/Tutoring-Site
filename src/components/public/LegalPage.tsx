import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/Alert";
import { Container, PageHeader } from "@/components/ui/Layout";

type Section = { h: string; items: string[] };

/** Shared layout for Privacy, Child Safety and Accessibility pages. */
export async function LegalPage({ ns, draft = true }: { ns: "privacy" | "safety" | "accessibility"; draft?: boolean }) {
  const t = await getTranslations(ns);
  const tl = await getTranslations("legal");
  const sections = t.raw("sections") as Section[];
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <Container className="prose-simple py-8">
        {draft ? <Alert tone="warning">{tl("draft")}</Alert> : null}
        {sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            <ul>
              {s.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-sm text-muted">{tl("updated", { date: "2026-11-10" })}</p>
      </Container>
    </>
  );
}
