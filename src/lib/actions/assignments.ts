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
import type { FormState } from "@/components/forms/ActionForm";

async function prefix() {
  const l = await getLocale();
  return l === "en" ? "" : `/${l}`;
}

function dueFrom(data: FormData) {
  const date = String(data.get("due_date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = /^\d{2}:\d{2}$/.test(String(data.get("due_time"))) ? String(data.get("due_time")) : "20:00";
  return detroitToDate(date, time).toISOString();
}

/** Tutor creates an assignment for one or more of THEIR students (RLS blocks anyone else's). */
export async function createAssignment(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser(["tutor"]);
  const t = await getTranslations("assign");
  const parsed = z
    .object({
      title: z.string().trim().min(1).max(150),
      instructions: z.string().trim().max(5000),
      subject: z.enum(site.subjects),
      students: z.array(z.string().uuid()).min(1),
    })
    .safeParse({
      title: data.get("title"),
      instructions: data.get("instructions") ?? "",
      subject: data.get("subject"),
      students: data.getAll("students").map(String),
    });
  if (!parsed.success) return { ok: false, message: t("invalid") };
  const supabase = await createClient();
  const { data: a, error } = await supabase
    .from("assignments")
    .insert({ tutor_id: user.id, title: parsed.data.title, instructions: parsed.data.instructions, subject: parsed.data.subject, due_at: dueFrom(data) })
    .select("id")
    .single();
  if (error || !a) return { ok: false, message: t("saveFailed") };
  const { error: linkErr } = await supabase.from("assignment_students").insert(parsed.data.students.map((s) => ({ assignment_id: a.id, student_id: s })));
  if (linkErr) {
    await supabase.from("assignments").delete().eq("id", a.id);
    return { ok: false, message: t("saveFailed") };
  }
  revalidatePath("/", "layout");
  return { ok: true, redirectTo: `${await prefix()}/dashboard/tutor/assignments/${a.id}?created=1` };
}

/** Save the list of attached files (they were uploaded straight to private storage). */
export async function saveAttachments(_: FormState, data: FormData): Promise<FormState> {
  await requireUser(["tutor"]);
  const t = await getTranslations("assign");
  const id = String(data.get("id"));
  const paths = data.getAll("attachments").map(String).filter((p) => p.startsWith(`${id}/`));
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("assignments").update({ attachment_paths: paths }).eq("id", id).select("id");
  if (error || !rows?.length) return { ok: false, message: t("saveFailed") };
  revalidatePath("/", "layout");
  return { ok: true, message: t("saved") };
}

export async function deleteAssignment(data: FormData) {
  await requireUser(["tutor"]);
  const id = String(data.get("id"));
  const supabase = await createClient();
  const { data: a } = await supabase.from("assignments").select("attachment_paths").eq("id", id).maybeSingle();
  if (a?.attachment_paths?.length) await supabase.storage.from("assignment-files").remove(a.attachment_paths);
  await supabase.from("assignments").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect({ href: "/dashboard/tutor/assignments", locale: await getLocale() });
}

/** Student (or their parent) turns in work: typed answer, photos, or both. */
export async function submitAssignment(_: FormState, data: FormData): Promise<FormState> {
  await requireUser(["student", "parent"]);
  const te = await getTranslations("errors");
  const t = await getTranslations("assign");
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_assignment", {
    p_assignment: String(data.get("assignment_id")),
    p_student: String(data.get("student_id")),
    p_answer: String(data.get("answer") || "").slice(0, 10000),
    p_files: data.getAll("files").map(String),
  });
  if (error) return { ok: false, message: te(errorKey(error.message)) };
  revalidatePath("/", "layout");
  return { ok: true, message: t("turnedIn") };
}

/** Tutor gives feedback, an optional score or sticker, and marks it done (or asks for another try). */
export async function reviewSubmission(_: FormState, data: FormData): Promise<FormState> {
  await requireUser(["tutor"]);
  const te = await getTranslations("errors");
  const t = await getTranslations("assign");
  const scoreRaw = String(data.get("score") || "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_submission", {
    p_submission: String(data.get("submission_id")),
    p_feedback: String(data.get("feedback") || ""),
    p_score: scoreRaw === "" ? null : Math.max(0, Math.min(100, Math.round(Number(scoreRaw)))),
    p_sticker: String(data.get("sticker") || ""),
    p_complete: data.get("outcome") !== "returned",
  });
  if (error) return { ok: false, message: te(errorKey(error.message)) };
  revalidatePath("/", "layout");
  return { ok: true, message: t("reviewed") };
}
