import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/forms/ActionForm";
import { Checkbox, ChoiceGroup, Honeypot, TextArea, TextField } from "@/components/ui/Field";
import { Container, PageHeader } from "@/components/ui/Layout";
import { submitTutorApplication } from "@/lib/actions/public";
import { subjectOptions } from "@/lib/options";
import { pageMeta, type PageProps } from "@/lib/meta";

export async function generateMetadata({ params }: PageProps) {
  return pageMeta((await params).locale, "volunteer", "/volunteer");
}

export default async function VolunteerPage({ params }: PageProps) {
  setRequestLocale((await params).locale);
  const t = await getTranslations("volunteer");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <Container className="max-w-2xl py-8">
        <p className="mb-6 text-lg">{t("who")}</p>
        <ActionForm
          action={submitTutorApplication}
          draftKey="volunteer"
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
          <ChoiceGroup legend={t("subjects")} name="subjects" options={subjectOptions(ts)} />
          <TextField label={t("grades")} name="grades" hint={t("gradesHint")} optionalText={tc("optional")} maxLength={100} />
          <TextArea label={t("availability")} name="availability" hint={t("availabilityHint")} optionalText={tc("optional")} rows={3} maxLength={1000} />
          <TextArea label={t("why")} name="why" optionalText={tc("optional")} maxLength={3000} />
          <Checkbox label={t("ageCheck")} name="age_ok" value="yes" required />
        </ActionForm>
      </Container>
    </>
  );
}
