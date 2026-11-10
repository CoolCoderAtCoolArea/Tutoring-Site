import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { requireUser } from "@/lib/auth";

export default async function PendingPage() {
  await requireUser();
  const t = await getTranslations("dash");
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-extrabold"><span aria-hidden="true">⏳ </span>{t("pendingTitle")}</h1>
      <p className="mt-3 text-lg">{t("pendingBody")}</p>
      <p className="mt-3 text-lg">{t("pendingProfile")}</p>
      <ButtonLink href="/dashboard/tutor/profile" className="mt-4">{t("menu.profile")}</ButtonLink>
    </div>
  );
}
