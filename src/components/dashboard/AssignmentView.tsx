import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/forms/ActionForm";
import { FileUpload } from "@/components/forms/FileUpload";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { TextArea } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Card, Tag } from "@/components/ui/Layout";
import { submitAssignment } from "@/lib/actions/assignments";
import { signedUrls } from "@/lib/files";
import { uploadLabels } from "@/lib/upload-labels";
import { formatDateTime } from "@/lib/time";
import type { Assignment, Submission } from "@/lib/types";

/** What a student (or their parent) sees for one assignment, with the turn-in form. Print-friendly. */
export async function AssignmentView({ assignment, submission, studentId, locale }: {
  assignment: Assignment; submission: Submission | null; studentId: string; locale: string;
}) {
  const t = await getTranslations("assign");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const [attachments, myFiles] = await Promise.all([
    signedUrls("assignment-files", assignment.attachment_paths),
    signedUrls("submission-files", submission?.file_paths ?? []),
  ]);
  const done = submission?.status === "complete";

  return (
    <article className="max-w-3xl">
      <p className="flex flex-wrap gap-2">
        <Tag>{ts.has(`names.${assignment.subject}`) ? ts(`names.${assignment.subject}`) : assignment.subject}</Tag>
        {assignment.due_at ? <Tag className="bg-sun-soft">{t("dueAt", { date: formatDateTime(assignment.due_at, locale) })}</Tag> : null}
      </p>
      <h1 className="mt-2 text-3xl font-extrabold">{assignment.title}</h1>
      <div className="no-print mt-2"><PrintButton label={t("print")} /></div>

      <Card className="print-break mt-4">
        <h2 className="text-xl font-bold">{t("instructions")}</h2>
        <p className="mt-2 whitespace-pre-line text-lg">{assignment.instructions || "—"}</p>
        {attachments.length ? (
          <>
            <h3 className="mt-4 font-bold">{t("attachments")}</h3>
            <ul className="mt-1 space-y-1">
              {attachments.map((f) => (
                <li key={f.path}>{f.url ? <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center">📎 {f.name}</a> : f.name}</li>
              ))}
            </ul>
          </>
        ) : null}
      </Card>

      {submission?.feedback || submission?.sticker || submission?.score != null ? (
        <Card className="print-break mt-6 border-leaf bg-leaf-soft">
          <h2 className="text-xl font-bold">{t("feedback")}</h2>
          {submission.sticker ? <p className="mt-2 text-5xl" role="img" aria-label={t("sticker")}>{submission.sticker}</p> : null}
          {submission.feedback ? <p className="mt-2 whitespace-pre-line text-lg">{submission.feedback}</p> : null}
          {submission.score != null ? <p className="mt-2 font-bold">{t("score", { score: submission.score })}</p> : null}
          {submission.status === "returned" ? <p className="mt-2 font-semibold">↩️ {t("tryAgain")}</p> : null}
        </Card>
      ) : null}

      <Card className="no-print mt-6">
        <h2 className="text-xl font-bold">{done ? t("doneTitle") : submission ? t("yourWork") : t("turnIn")}</h2>
        {submission ? <Alert tone={done ? "success" : "info"}>{t(`status.${submission.status}`)} · {formatDateTime(submission.submitted_at, locale)}</Alert> : null}
        {myFiles.length ? (
          <ul className="mb-3 flex flex-wrap gap-2">
            {myFiles.map((f) => f.url ? (
              <li key={f.path}><a href={f.url} target="_blank" rel="noopener noreferrer"><img src={f.url} alt={t("photoOfWork")} className="size-28 rounded-lg border border-line object-cover" loading="lazy" /></a></li>
            ) : null)}
          </ul>
        ) : null}
        {!done ? (
          <ActionForm action={submitAssignment} submitLabel={submission ? t("turnInAgain") : t("turnInButton")} pendingLabel={tc("sending")}
            draftKey={`assignment-${assignment.id}-${studentId}`} offlineMessage={tc("offline")} restoredMessage={tc("draftRestored")} resetOnSuccess={false}>
            <input type="hidden" name="assignment_id" value={assignment.id} />
            <input type="hidden" name="student_id" value={studentId} />
            <TextArea label={t("answer")} name="answer" rows={6} maxLength={10000} defaultValue={submission?.answer_text ?? ""} hint={t("answerHint")} />
            <FileUpload bucket="submission-files" folder={`${studentId}/${assignment.id}`} name="files" multiple
              label={t("photos")} hint={t("photosHint")} labels={await uploadLabels()}
              initial={(submission?.file_paths ?? []).map((p) => ({ path: p, name: p.split("/").pop()!.replace(/^\d+-/, "") }))} />
          </ActionForm>
        ) : null}
      </Card>
    </article>
  );
}
