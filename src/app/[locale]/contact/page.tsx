import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/config/site";
import { ActionForm } from "@/components/forms/ActionForm";
import { Honeypot, TextArea, TextField } from "@/components/ui/Field";
import { Container, PageHeader } from "@/components/ui/Layout";
import { submitContact } from "@/lib/actions/public";
import { pageMeta, type PageProps } from "@/lib/meta";

export async function generateMetadata({ params }: PageProps) {
  return pageMeta((await params).locale, "contact", "/contact");
}

export default async function ContactPage({ params }: PageProps) {
  setRequestLocale((await params).locale);
  const t = await getTranslations("contact");
  const tc = await getTranslations("common");
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")}>
        <p className="mt-3 text-lg">
          {t("emailUs")}{" "}
          <a href={`mailto:${site.email}`} className="font-semibold">
            {site.email}
          </a>
        </p>
      </PageHeader>
      <Container className="grid gap-10 py-8 lg:grid-cols-2">
        <ActionForm
          action={submitContact}
          draftKey="contact"
          submitLabel={t("send")}
          pendingLabel={tc("sending")}
          successMessage={t("success")}
          offlineMessage={tc("offline")}
          restoredMessage={tc("draftRestored")}
          className="relative"
        >
          <Honeypot />
          <TextField label={t("name")} name="name" required autoComplete="name" maxLength={100} />
          <TextField label={t("email")} name="email" type="email" required autoComplete="email" maxLength={200} />
          <TextArea label={t("message")} name="message" required rows={6} maxLength={4000} />
        </ActionForm>
        <div>
          <h2 className="text-2xl font-bold">{t("where")}</h2>
          <p className="mt-2 text-lg">{site.inPersonLocation}</p>
          {site.mapEmbedUrl ? (
            // Map only loads when scrolled into view, to save data.
            <iframe
              title={t("mapTitle")}
              src={site.mapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="mt-4 aspect-video w-full rounded-2xl border border-line"
            />
          ) : null}
        </div>
      </Container>
    </>
  );
}
