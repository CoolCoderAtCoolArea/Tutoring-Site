import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ActionForm } from "@/components/forms/ActionForm";
import { PasswordField } from "@/components/forms/PasswordField";
import { Honeypot, TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Container } from "@/components/ui/Layout";
import { signIn, studentSignIn } from "@/lib/actions/auth";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ as?: string; error?: string; next?: string }> };

export async function generateMetadata({ params }: Props) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "meta" });
  return { title: t("login"), robots: { index: false } };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { as, error, next } = await searchParams;
  if (await getSessionUser()) redirect({ href: "/dashboard", locale });
  const t = await getTranslations("auth");
  const student = as === "student";
  const tab = (active: boolean) =>
    cn("flex min-h-12 flex-1 items-center justify-center rounded-t-xl border-2 border-b-0 px-3 font-bold no-underline",
      active ? "border-brand bg-white text-ink" : "border-transparent bg-brand-soft text-brand");

  return (
    <Container className="max-w-lg py-8">
      <h1 className="text-3xl font-extrabold">{t("loginTitle")}</h1>
      <p className="mt-2 text-lg">{t("loginIntro")}</p>
      {error === "link" ? <Alert tone="error">{t("linkError")}</Alert> : null}

      {/* Two "tabs" made of links, so they work without JavaScript */}
      <div className="mt-6 flex gap-1 border-b-2 border-brand">
        <Link href="/login" className={tab(!student)} aria-current={!student ? "page" : undefined}>
          <span aria-hidden="true">👪&nbsp;</span>{t("tabFamily")}
        </Link>
        <Link href="/login?as=student" className={tab(student)} aria-current={student ? "page" : undefined}>
          <span aria-hidden="true">🎒&nbsp;</span>{t("tabStudent")}
        </Link>
      </div>

      <div className="rounded-b-2xl border-2 border-t-0 border-brand bg-white p-5">
        {student ? (
          <>
            <ActionForm action={studentSignIn} submitLabel={t("login")} pendingLabel={t("loggingIn")} submitClassName="w-full" className="relative">
              <Honeypot />
              <TextField label={t("username")} name="username" required autoComplete="username" autoCapitalize="none" spellCheck={false} />
              <PasswordField label={t("pin")} name="pin" hint={t("pinHint")} showLabel={t("showPassword")} autoComplete="current-password" inputMode="numeric" />
            </ActionForm>
            <p className="mt-4 text-muted">{t("studentHelp")}</p>
          </>
        ) : (
          <>
            <ActionForm action={signIn} submitLabel={t("login")} pendingLabel={t("loggingIn")} submitClassName="w-full">
              <input type="hidden" name="next" value={next?.startsWith("/") ? next : "/dashboard"} />
              <TextField label={t("email")} name="email" type="email" required autoComplete="email" />
              <PasswordField label={t("password")} showLabel={t("showPassword")} autoComplete="current-password" />
            </ActionForm>
            <p className="mt-4">
              <Link href="/forgot-password" className="inline-flex min-h-11 items-center">{t("forgot")}</Link>
            </p>
            <p>
              {t("noAccount")}{" "}
              <Link href="/signup" className="inline-flex min-h-11 items-center font-semibold">{t("createAccount")}</Link>
            </p>
          </>
        )}
      </div>
    </Container>
  );
}
