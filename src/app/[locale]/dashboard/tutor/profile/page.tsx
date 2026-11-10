import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/forms/ActionForm";
import { FileUpload } from "@/components/forms/FileUpload";
import { Checkbox, ChoiceGroup, Select, TextArea, TextField } from "@/components/ui/Field";
import { Card } from "@/components/ui/Layout";
import { requireUser } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveTutorProfile } from "@/lib/actions/tutor";
import { gradeOptions, subjectOptions } from "@/lib/options";
import { uploadLabels } from "@/lib/upload-labels";
import { site } from "@/config/site";

export default async function TutorProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(); // unapproved tutors may fill this in while they wait
  if (user.role !== "tutor") redirect({ href: "/dashboard", locale });
  const t = await getTranslations("tutor");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const supabase = await createClient();
  const { data: p } = await supabase.from("tutor_profiles").select("*").eq("tutor_id", user.id).maybeSingle();
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-extrabold">{t("profileTitle")}</h1>
      <p className="mt-2 text-lg">{t("profileIntro")}</p>
      <Card className="mt-6">
        <ActionForm action={saveTutorProfile} submitLabel={tc("save")} pendingLabel={tc("saving")} resetOnSuccess={false}>
          <TextField label={t("publicName")} name="public_name" required maxLength={80} defaultValue={p?.public_name ?? user.display_name} hint={t("publicNameHint")} />
          {user.approved ? (
            <FileUpload bucket="tutor-photos" folder={user.id} name="photo_url" label={t("photo")} hint={t("photoHint")} accept="image/jpeg,image/png,image/webp" maxBytes={2 * 1024 * 1024} publicUrl
              initial={p?.photo_url ? [{ path: p.photo_url, name: t("currentPhoto"), url: p.photo_url }] : []} labels={await uploadLabels()} />
          ) : <input type="hidden" name="photo_url" value={p?.photo_url ?? ""} />}
          <TextArea label={t("bio")} name="bio" maxLength={1200} defaultValue={p?.bio ?? ""} hint={t("bioHint")} />
          <TextField label={t("funFact")} name="fun_fact" maxLength={300} defaultValue={p?.fun_fact ?? ""} />
          <ChoiceGroup legend={t("subjectsTeach")} name="subjects" options={subjectOptions(ts)} defaultValue={p?.subjects ?? []} />
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Select label={t("gradeFrom")} name="grade_min" options={gradeOptions(tc)} defaultValue={site.grades[p?.grade_min ?? 0]} />
            <Select label={t("gradeTo")} name="grade_max" options={gradeOptions(tc)} defaultValue={site.grades[p?.grade_max ?? 12]} />
          </div>
          <ChoiceGroup legend={t("formats")} name="formats" options={[{ value: "in_person", label: tc("inPerson") }, { value: "online", label: tc("online") }]} defaultValue={p?.formats ?? ["in_person", "online"]} />
          <TextField label={t("languages")} name="languages" maxLength={100} defaultValue={p?.languages ?? "English"} />
          <Checkbox name="published" value="yes" defaultChecked={p?.published ?? false} label={t("publish")} />
        </ActionForm>
      </Card>
    </div>
  );
}
