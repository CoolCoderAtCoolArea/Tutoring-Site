import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/forms/ActionForm";
import { Card } from "@/components/ui/Layout";
import { TextArea, TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelSession, saveMeetingLink, saveSessionNote } from "@/lib/actions/booking";
import { formatDateTime, formatTime } from "@/lib/time";
import { formatLabel } from "@/lib/labels";
import type { Booking, SessionNote } from "@/lib/types";

export default async function TutorSessionPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await requireUser(["tutor"]);
  const t = await getTranslations("tutor");
  const tb = await getTranslations("booking");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const supabase = await createClient();
  const { data } = await supabase.from("bookings").select("*, students(id, nickname, grade)").eq("id", id).eq("tutor_id", user.id).maybeSingle();
  if (!data) notFound();
  const b = data as Booking & { students: { id: string; nickname: string; grade: string } };
  const { data: note } = await supabase.from("session_notes").select("*").eq("booking_id", id).maybeSingle();
  const n = note as SessionNote | null;
  const started = new Date(b.starts_at) <= new Date();

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-extrabold">{b.students.nickname} · {ts.has(`names.${b.subject}`) ? ts(`names.${b.subject}`) : b.subject}</h1>
      <Card className="mt-4">
        <p className="text-lg font-bold">{formatDateTime(b.starts_at, locale)}–{formatTime(b.ends_at, locale)}</p>
        <p>{tc("gradeN", { grade: b.students.grade })} · {formatLabel(tc, b.mode)} · {tb(`statuses.${b.status}`)}{b.is_intro ? ` · ${t("intro")}` : ""}</p>
        {b.note ? <Alert tone="info" title={t("familyNote")}>{b.note}</Alert> : null}
        {b.cancel_reason ? <p className="mt-2"><strong>{tb("reason")}:</strong> {b.cancel_reason}</p> : null}
      </Card>

      {b.mode === "online" && b.status === "booked" ? (
        <Card className="mt-6">
          <h2 className="mb-2 text-xl font-bold">{t("meetingLink")}</h2>
          <ActionForm action={saveMeetingLink} submitLabel={tc("save")} pendingLabel={tc("saving")} resetOnSuccess={false}>
            <input type="hidden" name="id" value={b.id} />
            <TextField label={t("meetingLinkLabel")} name="meeting_link" type="url" defaultValue={b.meeting_link ?? ""} placeholder="https://meet.google.com/…" hint={t("meetingLinkHint")} />
          </ActionForm>
        </Card>
      ) : null}

      {b.status !== "cancelled" ? (
        <Card className="mt-6">
          <h2 className="mb-1 text-xl font-bold">{t("sessionNote")}</h2>
          <p className="mb-3 text-muted">{t("sessionNoteHint")}</p>
          {!started && !n ? <Alert tone="info">{t("noteAfter")}</Alert> : null}
          <ActionForm action={saveSessionNote} submitLabel={t("saveNote")} pendingLabel={tc("saving")} resetOnSuccess={false} draftKey={n ? undefined : `note-${b.id}`}>
            <input type="hidden" name="booking_id" value={b.id} />
            <TextArea label={tb("workedOn")} name="worked_on" required defaultValue={n?.worked_on} maxLength={2000} rows={3} />
            <TextArea label={tb("practice")} name="practice" defaultValue={n?.practice} optionalText={tc("optional")} maxLength={2000} rows={3} />
          </ActionForm>
        </Card>
      ) : null}

      {b.status === "booked" ? (
        <Card className="mt-6">
          <details>
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-lg font-bold">{tb("cancel")}</summary>
            <p className="mt-2">{t("cancelExplain")}</p>
            <ActionForm action={cancelSession} submitLabel={tb("cancelIt")} pendingLabel={tc("saving")} submitVariant="danger" className="mt-3">
              <input type="hidden" name="id" value={b.id} />
              <TextArea label={t("cancelReason")} name="reason" required minLength={3} maxLength={500} rows={2} />
            </ActionForm>
          </details>
        </Card>
      ) : null}
    </div>
  );
}
