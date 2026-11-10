"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { errorKey } from "@/lib/errors";
import { detroitToDate } from "@/lib/time";
import { site } from "@/config/site";
import { gradeAttempt, isCorrect } from "@/lib/quiz/grade";
import { importQuestionsCsv } from "@/lib/quiz/csv";
import { validateQuestion } from "@/lib/quiz/validate";
import { loadKeys, loadOwnAttempt, writeAttempt } from "@/lib/quiz/server";
import type { Response } from "@/lib/quiz/types";
import type { FormState } from "@/components/forms/ActionForm";

async function prefix() {
  const l = await getLocale();
  return l === "en" ? "" : `/${l}`;
}

// ===================== TUTOR: building quizzes =====================

const settingsSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000),
  subject: z.enum(site.subjects),
  grade_band: z.string().trim().max(20),
  allow_retries: z.boolean(),
  show_answers: z.boolean(),
  instant_feedback: z.boolean(),
  time_limit_minutes: z.number().int().min(1).max(180).nullable(),
});

function readSettings(data: FormData) {
  const limit = String(data.get("time_limit_minutes") || "").trim();
  return settingsSchema.safeParse({
    title: data.get("title"),
    description: data.get("description") ?? "",
    subject: data.get("subject"),
    grade_band: data.get("grade_band") ?? "",
    allow_retries: data.get("allow_retries") === "yes",
    show_answers: data.get("show_answers") === "yes",
    instant_feedback: data.get("instant_feedback") === "yes",
    time_limit_minutes: data.get("timer_on") === "yes" && limit ? Number(limit) : null,
  });
}

export async function createQuiz(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser(["tutor"]);
  const t = await getTranslations("quiz");
  const parsed = readSettings(data);
  if (!parsed.success) return { ok: false, message: t("settingsInvalid") };
  const supabase = await createClient();
  const { data: q, error } = await supabase.from("quizzes").insert({ ...parsed.data, tutor_id: user.id }).select("id").single();
  if (error || !q) return { ok: false, message: t("saveFailed") };
  revalidatePath("/", "layout");
  return { ok: true, redirectTo: `${await prefix()}/dashboard/tutor/quizzes/${q.id}` };
}

export async function updateQuizSettings(_: FormState, data: FormData): Promise<FormState> {
  await requireUser(["tutor", "admin"]);
  const t = await getTranslations("quiz");
  const parsed = readSettings(data);
  if (!parsed.success) return { ok: false, message: t("settingsInvalid") };
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("quizzes").update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", String(data.get("id"))).select("id");
  if (error || !rows?.length) return { ok: false, message: t("saveFailed") };
  revalidatePath("/", "layout");
  return { ok: true, message: t("saved") };
}

export async function deleteQuiz(data: FormData) {
  await requireUser(["tutor", "admin"]);
  const supabase = await createClient();
  await supabase.from("quizzes").delete().eq("id", String(data.get("id")));
  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/tutor/quizzes", locale: await getLocale() });
}

/** Copy a quiz (yours or one from the sample library) so you can edit and assign it. */
export async function duplicateQuiz(data: FormData) {
  const user = await requireUser(["tutor"]);
  const supabase = await createClient();
  const id = String(data.get("id"));
  const { data: quiz } = await supabase.from("quizzes").select("*").eq("id", id).maybeSingle();
  if (!quiz) return;
  const { data: questions } = await supabase.from("quiz_questions").select("*, quiz_question_keys(answer, explanation)").eq("quiz_id", id).order("position");
  const { id: _old, created_at: _c, updated_at: _u, ...rest } = quiz;
  const t = await getTranslations("quiz");
  const { data: copy } = await supabase.from("quizzes").insert({ ...rest, tutor_id: user.id, due_at: null, title: t("copyOf", { title: quiz.title }).slice(0, 150) }).select("id").single();
  if (!copy) return;
  for (const q of questions ?? []) {
    const key = Array.isArray(q.quiz_question_keys) ? q.quiz_question_keys[0] : q.quiz_question_keys;
    const { data: nq } = await supabase
      .from("quiz_questions")
      .insert({ quiz_id: copy.id, position: q.position, type: q.type, prompt: q.prompt, image_url: q.image_url, choices: q.choices, hint: q.hint, points: q.points })
      .select("id")
      .single();
    if (nq && key) await supabase.from("quiz_question_keys").insert({ question_id: nq.id, answer: key.answer, explanation: key.explanation });
  }
  revalidatePath("/", "layout");
  redirect({ href: `/dashboard/tutor/quizzes/${copy.id}`, locale: await getLocale() });
}

/** Add or update one question. `payload` is JSON built by the question editor. */
export async function saveQuestion(quizId: string, questionId: string | null, payload: unknown): Promise<{ ok: boolean; message: string }> {
  await requireUser(["tutor", "admin"]);
  const t = await getTranslations("quiz");
  const v = validateQuestion(payload);
  if (!v.ok) return { ok: false, message: `${t("questionInvalid")} (${v.error})` };
  const { answer, explanation, ...pub } = v.q;
  const supabase = await createClient();
  let id = questionId;
  if (id) {
    const { data: rows, error } = await supabase.from("quiz_questions").update(pub).eq("id", id).eq("quiz_id", quizId).select("id");
    if (error || !rows?.length) return { ok: false, message: t("saveFailed") };
  } else {
    const { count } = await supabase.from("quiz_questions").select("id", { count: "exact", head: true }).eq("quiz_id", quizId);
    const { data: row, error } = await supabase.from("quiz_questions").insert({ ...pub, quiz_id: quizId, position: (count ?? 0) + 1 }).select("id").single();
    if (error || !row) return { ok: false, message: t("saveFailed") };
    id = row.id;
  }
  const { error: keyErr } = await supabase.from("quiz_question_keys").upsert({ question_id: id, answer, explanation: explanation ?? null });
  if (keyErr) return { ok: false, message: t("saveFailed") };
  revalidatePath("/", "layout");
  return { ok: true, message: t("questionSaved") };
}

export async function deleteQuestion(data: FormData) {
  await requireUser(["tutor", "admin"]);
  const supabase = await createClient();
  await supabase.from("quiz_questions").delete().eq("id", String(data.get("id")));
  revalidatePath("/", "layout");
}

/** Move a question up or down by swapping positions with its neighbor. */
export async function moveQuestion(data: FormData) {
  await requireUser(["tutor", "admin"]);
  const supabase = await createClient();
  const quizId = String(data.get("quiz_id"));
  const id = String(data.get("id"));
  const dir = data.get("dir") === "up" ? -1 : 1;
  const { data: list } = await supabase.from("quiz_questions").select("id, position").eq("quiz_id", quizId).order("position");
  if (!list) return;
  const i = list.findIndex((q) => q.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((q, k) => supabase.from("quiz_questions").update({ position: k + 1 }).eq("id", q.id)));
  revalidatePath("/", "layout");
}

export async function importCsv(_: FormState, data: FormData): Promise<FormState> {
  await requireUser(["tutor", "admin"]);
  const t = await getTranslations("quiz");
  const file = data.get("csv");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: t("csvMissing") };
  if (file.size > 500_000) return { ok: false, message: t("csvTooBig") };
  const { questions, errors } = importQuestionsCsv(await file.text());
  if (errors.length) return { ok: false, message: t("csvErrors"), errors: errors.slice(0, 20) };
  const quizId = String(data.get("quiz_id"));
  let saved = 0;
  for (const q of questions) {
    const r = await saveQuestion(quizId, null, q);
    if (r.ok) saved++;
  }
  return { ok: saved === questions.length, message: t("csvImported", { count: saved }) };
}

/** Assign the quiz to some of YOUR students (RLS blocks anyone else). */
export async function assignQuiz(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser(["tutor"]);
  const t = await getTranslations("quiz");
  const quizId = String(data.get("quiz_id"));
  const students = data.getAll("students").map(String);
  const supabase = await createClient();
  const date = String(data.get("due_date") || "");
  await supabase.from("quizzes").update({ due_at: /^\d{4}-\d{2}-\d{2}$/.test(date) ? detroitToDate(date, "20:00").toISOString() : null }).eq("id", quizId);
  // Replace the assignment list with exactly what's checked.
  const { data: current } = await supabase.from("quiz_assignments").select("student_id").eq("quiz_id", quizId);
  const now = new Set((current ?? []).map((c) => c.student_id));
  const add = students.filter((s) => !now.has(s));
  const remove = [...now].filter((s) => !students.includes(s));
  if (add.length) {
    const { error } = await supabase.from("quiz_assignments").insert(add.map((s) => ({ quiz_id: quizId, student_id: s, assigned_by: user.id })));
    if (error) return { ok: false, message: t("saveFailed") };
  }
  if (remove.length) await supabase.from("quiz_assignments").delete().eq("quiz_id", quizId).in("student_id", remove);
  revalidatePath("/", "layout");
  return { ok: true, message: t("assigned") };
}

// ===================== STUDENT: taking quizzes =====================

export async function startQuiz(data: FormData) {
  const user = await requireUser(["student", "parent"]);
  const supabase = await createClient();
  const { data: attemptId, error } = await supabase.rpc("start_quiz_attempt", { p_quiz: String(data.get("quiz_id")), p_student: String(data.get("student_id")) });
  const locale = await getLocale();
  if (error) redirect({ href: user.role === "student" ? `/dashboard/student/quizzes?error=${errorKey(error.message)}` : "/dashboard/parent", locale });
  redirect({ href: `/dashboard/quiz/${attemptId}`, locale });
}

/** Auto-save: the student's answers so far and which question they're on. */
export async function saveProgress(attemptId: string, responses: Record<string, Response>, index: number) {
  await requireUser(["student", "parent"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("quiz_attempts")
    .update({ responses, current_index: Math.max(0, Math.min(500, Math.round(index))) })
    .eq("id", attemptId)
    .eq("status", "in_progress");
  return { ok: !error };
}

export type CheckResult = { correct: boolean; final: boolean; hint?: string | null; explanation?: string | null };

/**
 * Instant feedback for one question. First wrong try: show the hint and let
 * them try again. Second try (or no hint): final, show the explanation.
 */
export async function checkAnswer(attemptId: string, questionId: string, response: Response): Promise<CheckResult | null> {
  await requireUser(["student", "parent"]);
  const own = await loadOwnAttempt(attemptId);
  if (!own || own.attempt.status !== "in_progress" || !own.quiz.instant_feedback) return null;
  const q = (await loadKeys(own.quiz.id)).find((x) => x.id === questionId);
  if (!q) return null;
  const prev = (own.attempt.results as Record<string, { correct: boolean; earned: number; tries?: number; final?: boolean }>)[questionId];
  if (prev?.final) return { correct: prev.correct, final: true, explanation: q.explanation };
  const correct = isCorrect(q.type, q.answer, response);
  const tries = (prev?.tries ?? 0) + 1;
  const final = correct || tries >= 2 || !q.hint;
  await writeAttempt(attemptId, {
    responses: { ...own.attempt.responses, [questionId]: response },
    results: { ...own.attempt.results, [questionId]: { correct, earned: correct ? q.points : 0, tries, final } } as never,
  });
  return { correct, final, hint: final ? null : q.hint, explanation: final ? q.explanation : null };
}

/** Finish the quiz: grade everything on the server and save the score. */
export async function submitQuiz(attemptId: string, responses: Record<string, Response>) {
  await requireUser(["student", "parent"]);
  const own = await loadOwnAttempt(attemptId);
  if (!own || own.attempt.status !== "in_progress") return { ok: false };
  const keys = await loadKeys(own.quiz.id);
  const prior = own.attempt.results as Record<string, { correct: boolean; earned: number; final?: boolean }>;
  // Answers already checked with instant feedback keep that result.
  const merged = { ...responses, ...Object.fromEntries(Object.keys(prior).filter((k) => prior[k].final).map((k) => [k, own.attempt.responses[k] as Response])) };
  const graded = gradeAttempt(keys, merged);
  for (const [qid, r] of Object.entries(prior)) if (r.final) graded.results[qid] = { correct: r.correct, earned: r.earned };
  const score = Object.values(graded.results).reduce((s, r) => s + r.earned, 0);
  const { error } = await writeAttempt(attemptId, {
    responses: merged as never,
    results: graded.results as never,
    score,
    max_score: graded.max,
    status: "submitted",
    submitted_at: new Date().toISOString(),
  });
  revalidatePath("/", "layout");
  return { ok: !error };
}
