import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/forms/ActionForm";
import { ChoiceGroup, Select, TextField } from "@/components/ui/Field";
import { Card, EmptyState } from "@/components/ui/Layout";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addAvailability, addBlock, deleteAvailability, deleteBlock } from "@/lib/actions/tutor";
import { subjectOptions } from "@/lib/options";
import { detroitDateKey } from "@/lib/time";

export default async function AvailabilityEditor({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(["tutor"]);
  const t = await getTranslations("tutor");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const supabase = await createClient();
  const [{ data: rules }, { data: blocks }] = await Promise.all([
    supabase.from("availability_rules").select("*").eq("tutor_id", user.id).order("weekday").order("start_time"),
    supabase.from("availability_blocks").select("*").eq("tutor_id", user.id).gte("block_date", detroitDateKey(new Date())).order("block_date"),
  ]);
  const weekday = (d: number) => new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2023, 0, 1 + d)));
  const hm = (s: string) => s.slice(0, 5);

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-extrabold">{t("availabilityTitle")}</h1>
      <p className="mt-2 text-lg">{t("availabilityIntro")} {tc("detroitTime")}</p>

      <section className="mt-6" aria-labelledby="hours">
        <h2 id="hours" className="mb-3 text-2xl font-bold">{t("weeklyHours")}</h2>
        {rules?.length ? (
          <ul className="space-y-2">
            {rules.map((r) => (
              <Card as="li" key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold">{weekday(r.weekday)} · {hm(r.start_time)}–{hm(r.end_time)}</p>
                  <p className="text-sm text-muted">
                    {r.subjects.map((s: string) => ts(`names.${s}`)).join(", ")} · {r.modes.map((m: string) => (m === "online" ? tc("online") : tc("inPerson"))).join(" / ")} · {tc("minutes", { count: r.slot_minutes })}
                  </p>
                </div>
                <form action={deleteAvailability}>
                  <input type="hidden" name="id" value={r.id} />
                  <ConfirmButton variant="ghost" confirm={t("confirmDelete")}>{tc("delete")}</ConfirmButton>
                </form>
              </Card>
            ))}
          </ul>
        ) : <EmptyState>{t("noHours")}</EmptyState>}

        <Card className="mt-4">
          <h3 className="mb-3 text-xl font-bold">{t("addHours")}</h3>
          <ActionForm action={addAvailability} submitLabel={t("addHours")} pendingLabel={tc("saving")} resetOnSuccess={false}>
            <ChoiceGroup legend={t("days")} name="weekdays" options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: weekday(d) }))} />
            <div className="grid gap-x-4 sm:grid-cols-3">
              <TextField label={t("from")} name="start_time" type="time" required defaultValue="16:00" step={900} />
              <TextField label={t("to")} name="end_time" type="time" required defaultValue="18:00" step={900} />
              <Select label={t("sessionLength")} name="slot_minutes" defaultValue="60" options={[30, 45, 60, 90].map((m) => ({ value: String(m), label: tc("minutes", { count: m }) }))} />
            </div>
            <ChoiceGroup legend={tc("subject")} name="subjects" options={subjectOptions(ts)} />
            <ChoiceGroup legend={t("formats")} name="modes" defaultValue={["in_person", "online"]} options={[{ value: "in_person", label: tc("inPerson") }, { value: "online", label: tc("online") }]} />
          </ActionForm>
        </Card>
      </section>

      <section className="mt-10" aria-labelledby="blocks">
        <h2 id="blocks" className="mb-1 text-2xl font-bold">{t("daysOff")}</h2>
        <p className="mb-3 text-muted">{t("daysOffIntro")}</p>
        {blocks?.length ? (
          <ul className="mb-4 space-y-2">
            {blocks.map((b) => (
              <Card as="li" key={b.id} className="flex items-center justify-between gap-2">
                <p><strong>{b.block_date}</strong>{b.reason ? ` · ${b.reason}` : ""}</p>
                <form action={deleteBlock}>
                  <input type="hidden" name="id" value={b.id} />
                  <ConfirmButton variant="ghost" confirm={t("confirmDelete")}>{tc("delete")}</ConfirmButton>
                </form>
              </Card>
            ))}
          </ul>
        ) : null}
        <Card>
          <ActionForm action={addBlock} submitLabel={t("blockDate")} pendingLabel={tc("saving")}>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <TextField label={t("date")} name="block_date" type="date" required min={detroitDateKey(new Date())} />
              <TextField label={t("reasonPrivate")} name="reason" optionalText={tc("optional")} maxLength={200} />
            </div>
          </ActionForm>
        </Card>
      </section>
    </div>
  );
}
