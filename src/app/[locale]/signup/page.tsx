import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ActionForm } from "@/components/forms/ActionForm";
import { PasswordField } from "@/components/forms/PasswordField";
import { Checkbox, ChoiceGroup, Honeypot, TextField } from "@/components/ui/Field";
import { Container } from "@/components/ui/Layout";
import { signUp } from "@/lib/actions/auth";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ role?: string }> };

export async function generateMetadata({ params }: Props) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "meta" });
  return { title: t("signup") };
}

export default async function SignupPage({ params, searchParams }: Props) {
  setRequestLocale((await params).locale);
  const { role } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <Container className="max-w-lg py-8">
      <h1 className="text-3xl font-extrabold">{t("signupTitle")}</h1>
      <p className="mt-2 text-lg">{t("signupIntro")}</p>
      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <ActionForm action={signUp} submitLabel={t("signup")} pendingLabel={t("signingUp")} submitClassName="w-full" className="relative">
          <Honeypot />
          <ChoiceGroup
            legend={t("iAm")}
            name="role"
            type="radio"
            required
            defaultValue={role === "tutor" ? "tutor" : "parent"}
            options={[
              { value: "parent", label: t("roleParent") },
              { value: "tutor", label: t("roleTutor") },
            ]}
            hint={t("tutorNote")}
          />
          <TextField label={t("name")} name="name" required hint={t("nameHint")} autoComplete="given-name" maxLength={80} />
          <TextField label={t("email")} name="email" type="email" required autoComplete="email" />
          <PasswordField label={t("password")} hint={t("passwordHint")} showLabel={t("showPassword")} autoComplete="new-password" minLength={8} />
          <Checkbox name="agree" value="yes" required label={<>{t("agree")} <Link href="/privacy">{t("privacyLink")}</Link></>} />
        </ActionForm>
        <p className="mt-4">
          {t("haveAccount")} <Link href="/login" className="inline-flex min-h-11 items-center font-semibold">{t("login")}</Link>
        </p>
      </div>
    </Container>
  );
}
