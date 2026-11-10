import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ActionForm } from "@/components/forms/ActionForm";
import { TextField } from "@/components/ui/Field";
import { Card } from "@/components/ui/Layout";
import { Alert } from "@/components/ui/Alert";
import { requireUser } from "@/lib/auth";
import { deleteFamilyData } from "@/lib/actions/parent";

export default async function FamilyDataPage() {
  await requireUser(["parent"]);
  const t = await getTranslations("parent");
  const tc = await getTranslations("common");
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-extrabold">{t("dataTitle")}</h1>
      <p className="mt-2 text-lg">{t("dataIntro")} <Link href="/privacy">{t("privacyLink")}</Link></p>

      <Card className="mt-6">
        <h2 className="text-xl font-bold"><span aria-hidden="true">⬇️ </span>{t("downloadTitle")}</h2>
        <p className="mt-1">{t("downloadBody")}</p>
        <a href="/api/family-data" className="mt-3 inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-semibold text-white no-underline hover:text-white" download>
          {t("download")}
        </a>
      </Card>

      <Card className="mt-6 border-danger">
        <h2 className="text-xl font-bold"><span aria-hidden="true">🗑️ </span>{t("deleteTitle")}</h2>
        <Alert tone="warning">{t("deleteWarning")}</Alert>
        <ActionForm action={deleteFamilyData} submitLabel={t("deleteEverything")} pendingLabel={tc("saving")} submitVariant="danger">
          <TextField label={t("typeDelete")} name="confirm" required autoComplete="off" />
        </ActionForm>
      </Card>
    </div>
  );
}
