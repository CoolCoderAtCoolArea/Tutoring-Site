import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/forms/ActionForm";
import { ChoiceGroup, Select, TextArea, TextField } from "@/components/ui/Field";
import { Card, EmptyState } from "@/components/ui/Layout";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAssignment } from "@/lib/actions/assignments";
import { subjectOptions } from "@/lib/options";
import { detroitDateKey } from "@/lib/time";

export default async function NewAssignment() {
  await requireUser(["tutor"]);
  const t = await getTranslations("assign");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const supabase = await createClient();
  const { data: students } = await supabase.from("students").select("id, nickname, grade").order("nickname");
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-extrabold">{t("new")}</h1>
      {!students?.length ? <div className="mt-6"><EmptyState>{t("needStudents")}</EmptyState></div> : (
        <Card className="mt-6">
          <ActionForm action={createAssignment} submitLabel={t("create")} pendingLabel={tc("saving")} draftKey="new-assignment">
            <TextField label={t("titleLabel")} name="title" required maxLength={150} />
            <Select label={tc("subject")} name="subject" required options={subjectOptions(ts)} placeholder="—" />
            <TextArea label={t("instructions")} name="instructions" rows={6} maxLength={5000} hint={t("instructionsHint")} />
            <div className="grid gap-x-4 sm:grid-cols-2">
              <TextField label={t("dueDate")} name="due_date" type="date" optionalText={tc("optional")} min={detroitDateKey(new Date())} />
              <TextField label={t("dueTime")} name="due_time" type="time" optionalText={tc("optional")} defaultValue="20:00" />
            </div>
            <ChoiceGroup legend={t("assignTo")} name="students" hint={t("assignToHint")}
              options={students.map((s) => ({ value: s.id, label: `${s.nickname} (${tc("gradeN", { grade: s.grade })})` }))} />
            <p className="mb-4 text-muted">{t("filesAfter")}</p>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
