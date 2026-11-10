import { getTranslations } from "next-intl/server";
import { Checkbox, Select, TextArea, TextField } from "@/components/ui/Field";
import { subjectOptions } from "@/lib/options";
import type { Quiz } from "@/lib/types";

/** Shared fields for creating and editing a quiz's settings. */
export async function QuizSettingsFields({ quiz }: { quiz?: Quiz }) {
  const t = await getTranslations("quiz");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  return (
    <>
      <TextField label={t("titleLabel")} name="title" required maxLength={150} defaultValue={quiz?.title} />
      <TextArea label={t("description")} name="description" rows={2} maxLength={1000} optionalText={tc("optional")} defaultValue={quiz?.description} />
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Select label={tc("subject")} name="subject" required options={subjectOptions(ts)} defaultValue={quiz?.subject ?? ""} placeholder="—" />
        <TextField label={t("gradeBand")} name="grade_band" maxLength={20} placeholder="3–5" defaultValue={quiz?.grade_band} />
      </div>
      <Checkbox name="instant_feedback" value="yes" defaultChecked={quiz?.instant_feedback ?? true} label={t("instantFeedback")} />
      <Checkbox name="allow_retries" value="yes" defaultChecked={quiz?.allow_retries ?? true} label={t("allowRetries")} />
      <Checkbox name="show_answers" value="yes" defaultChecked={quiz?.show_answers ?? true} label={t("showAnswers")} />
      <Checkbox name="timer_on" value="yes" defaultChecked={Boolean(quiz?.time_limit_minutes)} label={t("timerOn")} />
      <TextField label={t("timeLimit")} name="time_limit_minutes" type="number" min={1} max={180} defaultValue={quiz?.time_limit_minutes ?? ""} className="max-w-48" hint={t("timerHint")} />
    </>
  );
}
