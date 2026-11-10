import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/forms/ActionForm";
import { FileUpload } from "@/components/forms/FileUpload";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { ChoiceGroup, TextArea, TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Card, EmptyState, Tag } from "@/components/ui/Layout";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteAssignment, reviewSubmission, saveAttachments } from "@/lib/actions/assignments";
import { signedUrls } from "@/lib/files";
import { uploadLabels } from "@/lib/upload-labels";
import { formatDateTime } from "@/lib/time";
import type { Assignment, Submission } from "@/lib/types";

const STICKERS = ["⭐", "🌟", "🏆", "💪", "🎉", "👏", "🚀", "🧠"];

export default async function TutorAssignmentDetail({ params, searchParams }: {
  params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ created?: string }>;
}) {
  const { locale, id } = await params;
  const { created } = await searchParams;
  const user = await requireUser(["tutor"]);
  const t = await getTranslations("assign");
  const tc = await getTranslations("common");
  const supabase = await createClient();
  const { data } = await supabase.from("assignments").select("*").eq("id", id).eq("tutor_id", user.id).maybeSingle();
  if (!data) notFound();
  const a = data as Assignment;
  const [{ data: links }, { data: subs }] = await Promise.all([
    supabase.from("assignment_students").select("student_id, students(nickname)").eq("assignment_id", id),
    supabase.from("submissions").select("*").eq("assignment_id", id),
  ]);
  const submissions = (subs ?? []) as Submission[];
  const files = await signedUrls("submission-files", submissions.flatMap((s) => s.file_paths));
  const attachments = a.attachment_paths.map((p) => ({ path: p, name: p.split("/").pop()!.replace(/^\d+-/, "") }));
  const labels = await uploadLabels();

  return (
    <div className="max-w-3xl">
      {created ? <Alert tone="success" live>{t("createdNow")}</Alert> : null}
      <h1 className="text-3xl font-extrabold">{a.title}</h1>
      {a.due_at ? <p className="mt-1 text-muted">{t("dueAt", { date: formatDateTime(a.due_at, locale) })}</p> : null}
      <div className="no-print"><PrintButton label={t("print")} /></div>
      <Card className="print-break mt-4"><p className="whitespace-pre-line">{a.instructions || "—"}</p></Card>

      <Card className="no-print mt-6">
        <h2 className="mb-2 text-xl font-bold">{t("attachments")}</h2>
        <ActionForm action={saveAttachments} submitLabel={t("saveFiles")} pendingLabel={tc("saving")} resetOnSuccess={false}>
          <input type="hidden" name="id" value={a.id} />
          <FileUpload bucket="assignment-files" folder={a.id} name="attachments" multiple label={t("addFiles")} hint={t("addFilesHint")} labels={labels} initial={attachments} />
        </ActionForm>
      </Card>

      <h2 className="mb-3 mt-8 text-2xl font-bold">{t("studentWork")}</h2>
      {!links?.length ? <EmptyState>{t("noStudentsAssigned")}</EmptyState> : (
        <ul className="space-y-4">
          {(links as unknown as { student_id: string; students: { nickname: string } }[]).map((l) => {
            const s = submissions.find((x) => x.student_id === l.student_id);
            return (
              <Card as="li" key={l.student_id} className="print-break">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xl font-bold">{l.students.nickname}</h3>
                  <Tag className={s?.status === "submitted" ? "bg-sun-soft" : s?.status === "complete" ? "bg-leaf-soft" : ""}>{t(`status.${s?.status ?? "todo"}`)}</Tag>
                </div>
                {s ? (
                  <>
                    <p className="text-sm text-muted">{formatDateTime(s.submitted_at, locale)}</p>
                    {s.answer_text ? <p className="mt-2 whitespace-pre-line rounded-lg bg-paper p-3">{s.answer_text}</p> : null}
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {files.filter((f) => s.file_paths.includes(f.path)).map((f) => f.url ? (
                        <li key={f.path}><a href={f.url} target="_blank" rel="noopener noreferrer"><img src={f.url} alt={t("photoOfWorkBy", { name: l.students.nickname })} className="size-32 rounded-lg border border-line object-cover" loading="lazy" /></a></li>
                      ) : null)}
                    </ul>
                    <details className="no-print mt-3" open={s.status === "submitted"}>
                      <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand underline">{t("giveFeedback")}</summary>
                      <ActionForm action={reviewSubmission} submitLabel={t("sendFeedback")} pendingLabel={tc("saving")} resetOnSuccess={false} className="mt-2">
                        <input type="hidden" name="submission_id" value={s.id} />
                        <TextArea label={t("feedback")} name="feedback" rows={3} maxLength={3000} defaultValue={s.feedback ?? ""} hint={t("feedbackHint")} />
                        <ChoiceGroup legend={t("sticker")} name="sticker" type="radio" defaultValue={s.sticker ?? ""}
                          options={[{ value: "", label: t("noSticker") }, ...STICKERS.map((x) => ({ value: x, label: <span className="text-2xl">{x}</span> }))]} />
                        <TextField label={t("scoreLabel")} name="score" type="number" min={0} max={100} optionalText={tc("optional")} defaultValue={s.score ?? ""} className="max-w-48" />
                        <ChoiceGroup legend={t("outcome")} name="outcome" type="radio" defaultValue={s.status === "returned" ? "returned" : "complete"}
                          options={[{ value: "complete", label: `✅ ${t("markDone")}` }, { value: "returned", label: `↩️ ${t("askTryAgain")}` }]} />
                      </ActionForm>
                    </details>
                  </>
                ) : <p className="text-muted">{t("notYet")}</p>}
              </Card>
            );
          })}
        </ul>
      )}

      <form action={deleteAssignment} className="no-print mt-10">
        <input type="hidden" name="id" value={a.id} />
        <ConfirmButton variant="danger" confirm={t("confirmDelete")}>{t("delete")}</ConfirmButton>
      </form>
    </div>
  );
}
