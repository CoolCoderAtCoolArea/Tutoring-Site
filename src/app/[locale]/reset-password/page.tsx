import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/forms/ActionForm";
import { PasswordField } from "@/components/forms/PasswordField";
import { Container } from "@/components/ui/Layout";
import { updatePassword } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth";
import type { PageProps } from "@/lib/meta";

export default async function ResetPage({ params }: PageProps) {
  setRequestLocale((await params).locale);
  await requireUser(); // the email link logged them in
  const t = await getTranslations("auth");
  const tc = await getTranslations("common");
  return (
    <Container className="max-w-lg py-8">
      <h1 className="mb-6 text-3xl font-extrabold">{t("resetTitle")}</h1>
      <ActionForm action={updatePassword} submitLabel={t("savePassword")} pendingLabel={tc("saving")}>
        <PasswordField label={t("newPassword")} hint={t("passwordHint")} showLabel={t("showPassword")} autoComplete="new-password" minLength={8} />
      </ActionForm>
    </Container>
  );
}
