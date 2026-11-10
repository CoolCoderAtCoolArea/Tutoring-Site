import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/forms/ActionForm";
import { Honeypot, Select, TextArea, TextField } from "@/components/ui/Field";
import { Container, PageHeader } from "@/components/ui/Layout";
import { submitHelpRequest } from "@/lib/actions/public";
import { gradeOptions, subjectOptions } from "@/lib/options";
import { pageMeta, type PageProps } from "@/lib/meta";

export async function generateMetadata({ params }: PageProps) {
  return pageMeta((await params).locale, "help", "/help");
}

export default async function HelpPage({ params }: PageProps) {
  setRequestLocale((await params).locale);
  const t = await getTranslations("help");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <Container className="max-w-2xl py-8">
        <ActionForm
          action={submitHelpRequest}
          draftKey="help"
          submitLabel={t("send")}
          pendingLabel={tc("sending")}
          successMessage={t("success")}
          offlineMessage={tc("offline")}
          restoredMessage={tc("draftRestored")}
          className="relative"
        >
          <Honeypot />
          <TextField label={t("name")} name="student_name" required maxLength={40} autoComplete="off" />
          <TextField label={t("email")} name="contact_email" type="email" required hint={t("emailHint")} autoComplete="email" />
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Select label={t("grade")} name="grade" required options={gradeOptions(tc)} placeholder="—" />
            <Select label={t("subject")} name="subject" required options={subjectOptions(ts)} placeholder="—" />
          </div>
          <TextArea label={t("description")} name="description" required hint={t("descriptionHint")} rows={5} maxLength={3000} />
        </ActionForm>
      </Container>
    </>
  );
}
