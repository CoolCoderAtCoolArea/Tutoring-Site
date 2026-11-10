import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/forms/ActionForm";
import { Honeypot, TextField } from "@/components/ui/Field";
import { Container } from "@/components/ui/Layout";
import { requestPasswordReset } from "@/lib/actions/auth";
import type { PageProps } from "@/lib/meta";

export default async function ForgotPage({ params }: PageProps) {
  setRequestLocale((await params).locale);
  const t = await getTranslations("auth");
  const tc = await getTranslations("common");
  return (
    <Container className="max-w-lg py-8">
      <h1 className="text-3xl font-extrabold">{t("forgotTitle")}</h1>
      <p className="mb-6 mt-2 text-lg">{t("forgotIntro")}</p>
      <ActionForm action={requestPasswordReset} submitLabel={t("sendLink")} pendingLabel={tc("sending")} className="relative">
        <Honeypot />
        <TextField label={t("email")} name="email" type="email" required autoComplete="email" />
      </ActionForm>
    </Container>
  );
}
