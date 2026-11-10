import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/forms/ActionForm";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Layout";
import { TextArea } from "@/components/ui/Field";
import { SlotPicker } from "@/components/dashboard/SlotPicker";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOpenSlots } from "@/lib/slots";
import { cancelSession, rescheduleSession } from "@/lib/actions/booking";
import { formatDateTime, formatTime, hoursUntil } from "@/lib/time";
import { formatLabel } from "@/lib/labels";
import { site } from "@/config/site";
import type { Booking, SessionNote } from "@/lib/types";

type Props = { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ booked?: string }> };

export default async function ParentSessionPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const { booked } = await searchParams;
  await requireUser(["parent"]);
  const t = await getTranslations("booking");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const supabase = await createClient();
  const { data } = await supabase.from("bookings").select("*, students(nickname, grade)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const b = data as Booking & { students: { nickname: string; grade: string } };
  const [{ data: tp }, { data: note }] = await Promise.all([
    supabase.from("tutor_profiles").select("public_name").eq("tutor_id", b.tutor_id).maybeSingle(),
    supabase.from("session_notes").select("*").eq("booking_id", b.id).maybeSingle(),
  ]);
  const canChange = b.status === "booked" && hoursUntil(b.starts_at) >= site.cancelWindowHours;
  const newSlots = canChange
    ? ((await getOpenSlots({ subject: b.subject, mode: b.mode, grade: b.students.grade, tutor: b.tutor_id }, 21)) ?? [])
    : [];
  const subjectName = ts.has(`names.${b.subject}`) ? ts(`names.${b.subject}`) : b.subject;

  return (
    <div className="max-w-3xl">
      {booked ? (
        <Alert tone="success" live title={t("confirmedTitle")}>{t("confirmedBody")}</Alert>
      ) : null}
      <h1 className="text-3xl font-extrabold">{subjectName} · {b.students.nickname}</h1>
      <Card className="mt-4">
        <dl className="grid gap-2 sm:grid-cols-[10rem_1fr]">
          <dt className="font-bold">{t("when")}</dt>
          <dd>{formatDateTime(b.starts_at, locale)}–{formatTime(b.ends_at, locale)} <span className="text-muted">({tc("detroitTime")})</span></dd>
          <dt className="font-bold">{t("tutor")}</dt>
          <dd>{tp?.public_name}</dd>
          <dt className="font-bold">{t("format")}</dt>
          <dd>{formatLabel(tc, b.mode)}{b.mode === "in_person" ? ` — ${site.inPersonLocation}` : ""}</dd>
          <dt className="font-bold">{t("status")}</dt>
          <dd>{t(`statuses.${b.status}`)}{b.is_intro ? ` · ${t("introLabel")}` : ""}</dd>
          {b.note ? (<><dt className="font-bold">{t("noteLabel")}</dt><dd>{b.note}</dd></>) : null}
          {b.cancel_reason ? (<><dt className="font-bold">{t("reason")}</dt><dd>{b.cancel_reason}</dd></>) : null}
        </dl>

        {b.mode === "online" && b.status === "booked" ? (
          b.meeting_link ? (
            <a href={b.meeting_link} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-leaf px-5 font-bold text-white no-underline hover:text-white">
              <span aria-hidden="true">🎥&nbsp;</span>{t("joinVideo")}
            </a>
          ) : (
            <p className="mt-4 text-muted">{t("linkComing")}</p>
          )
        ) : null}

        {b.status === "booked" ? (
          <p className="mt-4">
            <a href={`/api/ics/${b.id}`} className="inline-flex min-h-11 items-center font-semibold">
              <span aria-hidden="true">📆&nbsp;</span>{t("addToCalendar")}
            </a>
          </p>
        ) : null}
      </Card>

      {note ? (
        <Card className="mt-6 border-leaf">
          <h2 className="text-xl font-bold"><span aria-hidden="true">📝 </span>{t("sessionNote")}</h2>
          <p className="mt-2 font-semibold">{t("workedOn")}</p>
          <p className="whitespace-pre-line">{(note as SessionNote).worked_on}</p>
          {(note as SessionNote).practice ? (
            <>
              <p className="mt-2 font-semibold">{t("practice")}</p>
              <p className="whitespace-pre-line">{(note as SessionNote).practice}</p>
            </>
          ) : null}
        </Card>
      ) : null}

      {b.status === "booked" ? (
        canChange ? (
          <>
            {newSlots.length ? (
              <Card className="mt-6">
                <details>
                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-lg font-bold">{t("reschedule")}</summary>
                  <ActionForm action={rescheduleSession} submitLabel={t("rescheduleIt")} pendingLabel={tc("saving")} className="mt-3">
                    <input type="hidden" name="id" value={b.id} />
                    <SlotPicker slots={newSlots} locale={locale} legend={t("pickNewTime")} showTutor={false} />
                  </ActionForm>
                </details>
              </Card>
            ) : null}
            <Card className="mt-6">
              <details>
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-lg font-bold">{t("cancel")}</summary>
                <ActionForm action={cancelSession} submitLabel={t("cancelIt")} pendingLabel={tc("saving")} className="mt-3">
                  <input type="hidden" name="id" value={b.id} />
                  <TextArea label={t("reason")} name="reason" optionalText={tc("optional")} rows={2} maxLength={500} />
                </ActionForm>
              </details>
            </Card>
          </>
        ) : (
          <Alert tone="info">{t("tooLateToChange", { hours: site.cancelWindowHours, email: site.email })}</Alert>
        )
      ) : null}
    </div>
  );
}
