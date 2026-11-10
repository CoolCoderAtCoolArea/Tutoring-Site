import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/forms/ActionForm";
import { Card } from "@/components/ui/Layout";
import { QuizSettingsFields } from "@/components/quiz/QuizSettingsFields";
import { requireUser } from "@/lib/auth";
import { createQuiz } from "@/lib/actions/quiz";

export default async function NewQuiz() {
  await requireUser(["tutor"]);
  const t = await getTranslations("quiz");
  const tc = await getTranslations("common");
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-extrabold">{t("new")}</h1>
      <p className="mt-2 text-lg">{t("newIntro")}</p>
      <Card className="mt-6">
        <ActionForm action={createQuiz} submitLabel={t("createAndAdd")} pendingLabel={tc("saving")}>
          <QuizSettingsFields />
        </ActionForm>
      </Card>
    </div>
  );
}
