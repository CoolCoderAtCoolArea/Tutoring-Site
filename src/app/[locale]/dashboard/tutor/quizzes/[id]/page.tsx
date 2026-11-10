import "katex/dist/katex.min.css";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ActionForm } from "@/components/forms/ActionForm";
import { ChoiceGroup, TextField } from "@/components/ui/Field";
import { Card, EmptyState, Tag } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { MathText } from "@/components/quiz/MathText";
import { QuestionEditor, type EditableQuestion, type EditorLabels } from "@/components/quiz/QuestionEditor";
import { QuizSettingsFields } from "@/components/quiz/QuizSettingsFields";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { assignQuiz, deleteQuestion, deleteQuiz, importCsv, moveQuestion, updateQuizSettings } from "@/lib/actions/quiz";
import { uploadLabels } from "@/lib/upload-labels";
import { detroitDateKey } from "@/lib/time";
import type { Quiz } from "@/lib/types";

export default async function EditQuiz({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["tutor", "admin"]);
  const t = await getTranslations("quiz");
  const tc = await getTranslations("common");
  const supabase = await createClient();
  const { data } = await supabase.from("quizzes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const quiz = data as Quiz;
  const canEdit = quiz.tutor_id === user.id || (quiz.tutor_id === null && user.role === "admin");
  const [{ data: qs }, { data: students }, { data: assigned }] = await Promise.all([
    supabase.from("quiz_questions").select("*, quiz_question_keys(answer, explanation)").eq("quiz_id", id).order("position"),
    user.role === "tutor" ? supabase.from("students").select("id, nickname, grade").order("nickname") : Promise.resolve({ data: [] }),
    supabase.from("quiz_assignments").select("student_id").eq("quiz_id", id),
  ]);
  const questions: EditableQuestion[] = (qs ?? []).map((q) => {
    const k = Array.isArray(q.quiz_question_keys) ? q.quiz_question_keys[0] : q.quiz_question_keys;
    return { ...q, answer: k?.answer ?? {}, explanation: k?.explanation ?? null };
  });
  const labels = { ...(t.raw("editor") as Record<string, string>), types: t.raw("types") } as EditorLabels;
  const upload = await uploadLabels();

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-extrabold">{quiz.title}</h1>
      <p className="mt-1"><Link href={`/dashboard/tutor/quizzes/${quiz.id}/results`} className="inline-flex min-h-11 items-center font-semibold">📊 {t("results")}</Link></p>

      {canEdit ? (
        <Card className="mt-4">
          <details>
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-xl font-bold">⚙️ {t("settings")}</summary>
            <ActionForm action={updateQuizSettings} submitLabel={tc("save")} pendingLabel={tc("saving")} resetOnSuccess={false} className="mt-3">
              <input type="hidden" name="id" value={quiz.id} />
              <QuizSettingsFields quiz={quiz} />
            </ActionForm>
          </details>
        </Card>
      ) : null}

      <h2 className="mb-3 mt-8 text-2xl font-bold">{t("questions")} ({questions.length})</h2>
      {questions.length === 0 ? <EmptyState>{t("noQuestions")}</EmptyState> : (
        <ol className="space-y-3">
          {questions.map((q, i) => (
            <Card as="li" key={q.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Tag>{labels.types[q.type]}</Tag>
                  <p className="mt-1 font-semibold">{i + 1}. <MathText text={q.prompt} /></p>
                </div>
                {canEdit ? (
                  <div className="flex gap-1">
                    {(["up", "down"] as const).map((dir) => (
                      <form key={dir} action={moveQuestion}>
                        <input type="hidden" name="quiz_id" value={quiz.id} /><input type="hidden" name="id" value={q.id} /><input type="hidden" name="dir" value={dir} />
                        <button type="submit" className="min-h-11 min-w-11 rounded-lg border border-line" aria-label={`${t(dir === "up" ? "moveUp" : "moveDown")} ${i + 1}`} disabled={(dir === "up" && i === 0) || (dir === "down" && i === questions.length - 1)}>{dir === "up" ? "↑" : "↓"}</button>
                      </form>
                    ))}
                    <form action={deleteQuestion}>
                      <input type="hidden" name="id" value={q.id} />
                      <ConfirmButton variant="ghost" confirm={t("confirmDeleteQuestion")} aria-label={`${tc("delete")} ${i + 1}`}>🗑</ConfirmButton>
                    </form>
                  </div>
                ) : null}
              </div>
              {canEdit ? (
                <details className="mt-2">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand underline">{tc("edit")}</summary>
                  <div className="mt-3"><QuestionEditor quizId={quiz.id} tutorId={user.id} question={q} labels={labels} uploadLabels={upload} /></div>
                </details>
              ) : null}
            </Card>
          ))}
        </ol>
      )}

      {canEdit ? (
        <>
          <Card className="mt-6">
            <h2 className="mb-3 text-xl font-bold">➕ {t("addQuestion")}</h2>
            <QuestionEditor quizId={quiz.id} tutorId={user.id} labels={labels} uploadLabels={upload} />
          </Card>
          <Card className="mt-6">
            <h2 className="text-xl font-bold">📄 {t("importCsv")}</h2>
            <p className="mt-1">{t("importIntro")} <a href="/quiz-template.csv" download>{t("downloadTemplate")}</a></p>
            <ActionForm action={importCsv} submitLabel={t("import")} pendingLabel={tc("saving")} className="mt-3">
              <input type="hidden" name="quiz_id" value={quiz.id} />
              <label htmlFor="csv" className="mb-1 block font-semibold">{t("csvFile")}</label>
              <input id="csv" name="csv" type="file" accept=".csv,text/csv" required className="mb-4 block min-h-12 w-full rounded-lg border-2 border-dashed border-line-strong bg-white p-3" />
            </ActionForm>
          </Card>
        </>
      ) : null}

      {canEdit && user.role === "tutor" ? (
        <Card className="mt-6">
          <h2 className="mb-3 text-xl font-bold">👥 {t("assign")}</h2>
          {!students?.length ? <p className="text-muted">{t("noStudents")}</p> : (
            <ActionForm action={assignQuiz} submitLabel={t("saveAssign")} pendingLabel={tc("saving")} resetOnSuccess={false}>
              <input type="hidden" name="quiz_id" value={quiz.id} />
              <ChoiceGroup legend={t("assignTo")} name="students" defaultValue={(assigned ?? []).map((a) => a.student_id)}
                options={students.map((s) => ({ value: s.id, label: `${s.nickname} (${tc("gradeN", { grade: s.grade })})` }))} />
              <TextField label={t("dueDate")} name="due_date" type="date" optionalText={tc("optional")} min={detroitDateKey(new Date())} defaultValue={quiz.due_at ? detroitDateKey(quiz.due_at) : ""} className="max-w-60" />
            </ActionForm>
          )}
        </Card>
      ) : null}

      {canEdit ? (
        <form action={deleteQuiz} className="mt-10">
          <input type="hidden" name="id" value={quiz.id} />
          <ConfirmButton variant="danger" confirm={t("confirmDelete")}>{t("delete")}</ConfirmButton>
        </form>
      ) : user.role === "tutor" ? <form className="mt-6"><Button type="button" disabled>{t("libraryReadOnly")}</Button></form> : null}
    </div>
  );
}
