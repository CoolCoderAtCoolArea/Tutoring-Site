import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/forms/ActionForm";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox, ChoiceGroup, Select, TextArea } from "@/components/ui/Field";
import { Card, EmptyState } from "@/components/ui/Layout";
import { SlotPicker } from "@/components/dashboard/SlotPicker";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOpenSlots } from "@/lib/slots";
import { bookSession } from "@/lib/actions/booking";
import { subjectOptions } from "@/lib/options";
import { gradeLabel } from "@/lib/labels";
import type { Student } from "@/lib/types";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ child?: string; subject?: string; mode?: string; tutor?: string; start?: string; intro?: string }>;
};

/**
 * Booking in 2 steps (works without JavaScript):
 *  1. Pick child, subject, tutor, and in-person/online -> "Show open times" (a GET form)
 *  2. Pick a time, add an optional note -> "Book this time"
 */
export default async function BookPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const user = await requireUser(["parent"]);
  const q = await searchParams;
  const t = await getTranslations("booking");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const supabase = await createClient();

  const [{ data: kids }, { data: tutors }] = await Promise.all([
    supabase.from("students").select("*").eq("parent_id", user.id).order("created_at"),
    supabase.from("tutor_profiles").select("tutor_id, public_name, subjects").eq("published", true).order("public_name"),
  ]);
  const children = (kids ?? []) as Student[];
  if (!children.length) {
    return (
      <div>
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <EmptyState>{t("addChildFirst")}</EmptyState>
        <ButtonLink href="/dashboard/parent/children" className="mt-4">{t("addChildButton")}</ButtonLink>
      </div>
    );
  }

  const child = children.find((c) => c.id === q.child) ?? (children.length === 1 ? children[0] : undefined);
  const subject = q.subject || child?.subjects[0] || "";
  const mode = q.mode === "in_person" || q.mode === "online" ? q.mode : "";
  const tutor = q.tutor || "any";
  const ready = Boolean(child && subject && mode);
  const slots = ready
    ? (await getOpenSlots({ subject, mode, grade: child!.grade, tutor: tutor === "any" ? undefined : tutor }, 21)) ?? []
    : [];

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-extrabold">{t("title")}</h1>
      <p className="mt-2 text-lg">{t("intro")}</p>

      {/* STEP 1 */}
      <Card className="mt-6">
        <h2 className="mb-3 text-xl font-bold"><span aria-hidden="true">1️⃣ </span>{t("step1")}</h2>
        <form method="get">
          <ChoiceGroup legend={t("whichChild")} name="child" type="radio" required defaultValue={child?.id}
            options={children.map((c) => ({ value: c.id, label: `${c.nickname} (${gradeLabel(tc, c.grade)})` }))} />
          <Select label={tc("subject")} name="subject" required options={subjectOptions(ts)} defaultValue={subject} placeholder="—" />
          <Select label={t("tutor")} name="tutor" defaultValue={tutor}
            options={[{ value: "any", label: tc("anyTutor") }, ...(tutors ?? []).map((x) => ({ value: x.tutor_id, label: x.public_name }))]} />
          <ChoiceGroup legend={t("format")} name="mode" type="radio" required defaultValue={mode}
            options={[{ value: "in_person", label: `🏫 ${tc("inPerson")}` }, { value: "online", label: `💻 ${tc("online")}` }]} />
          {q.start ? <input type="hidden" name="start" value={q.start} /> : null}
          {q.intro ? <input type="hidden" name="intro" value={q.intro} /> : null}
          <Button type="submit" variant="secondary">{t("showTimes")}</Button>
        </form>
      </Card>

      {/* STEP 2 */}
      {ready ? (
        <Card className="mt-6">
          <h2 className="mb-1 text-xl font-bold"><span aria-hidden="true">2️⃣ </span>{t("step2")}</h2>
          <p className="mb-4 text-muted">{tc("detroitTime")}</p>
          {slots.length === 0 ? (
            <EmptyState>{t("noTimes")}</EmptyState>
          ) : (
            <ActionForm action={bookSession} submitLabel={t("bookIt")} pendingLabel={t("booking")} draftKey={`book-${child!.id}`}
              offlineMessage={tc("offline")} restoredMessage={tc("draftRestored")} submitClassName="w-full sm:w-auto">
              <input type="hidden" name="student" value={child!.id} />
              <input type="hidden" name="subject" value={subject} />
              <input type="hidden" name="mode" value={mode} />
              <input type="hidden" name="tutor" value={tutor} />
              <SlotPicker slots={slots} locale={locale} legend={t("pickTime")} showTutor={tutor === "any"} defaultValue={q.start} />
              <TextArea label={t("note")} name="note" hint={t("noteHint")} optionalText={tc("optional")} maxLength={1000} rows={3} />
              <Checkbox name="intro" value="1" defaultChecked={q.intro === "1"} label={t("introCheck")} />
            </ActionForm>
          )}
        </Card>
      ) : null}
    </div>
  );
}
