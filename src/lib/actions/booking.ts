"use server";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { errorKey } from "@/lib/errors";
import { emailBookingCancelled, emailBookingConfirmed } from "@/lib/notify";
import { site } from "@/config/site";
import type { FormState } from "@/components/forms/ActionForm";

async function dashUrl(path: string) {
  const locale = await getLocale();
  return (locale === "en" ? "" : `/${locale}`) + path;
}

/** Parent books a session. All rules are checked again inside the database (book_session). */
export async function bookSession(_: FormState, data: FormData): Promise<FormState> {
  await requireUser(["parent"]);
  const te = await getTranslations("errors");
  const student = String(data.get("student") || "");
  const subject = String(data.get("subject") || "");
  const mode = String(data.get("mode") || "");
  const slot = String(data.get("slot") || "");
  const tutor = String(data.get("tutor") || "");
  if (!student || !slot || !(site.subjects as readonly string[]).includes(subject)) return { ok: false, message: te("pickTime") };

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("book_session", {
    p_student: student,
    p_tutor: tutor && tutor !== "any" ? tutor : null,
    p_subject: subject,
    p_starts_at: slot,
    p_mode: mode,
    p_note: String(data.get("note") || "").slice(0, 1000),
    p_is_intro: data.get("intro") === "1",
  });
  if (error) return { ok: false, message: te(errorKey(error.message)) };

  await emailBookingConfirmed(id as string).catch((e) => console.error("confirmation email failed", e));
  revalidatePath("/", "layout");
  return { ok: true, redirectTo: await dashUrl(`/dashboard/parent/sessions/${id}?booked=1`) };
}

/** Parent or tutor cancels. Tutors must give a reason (the database checks). */
export async function cancelSession(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser(["parent", "tutor", "admin"]);
  const te = await getTranslations("errors");
  const tb = await getTranslations("booking");
  const id = String(data.get("id") || "");
  const supabase = await createClient();
  const { data: who, error } = await supabase.rpc("cancel_booking", { p_booking: id, p_reason: String(data.get("reason") || "") });
  if (error) return { ok: false, message: te(errorKey(error.message)) };
  await emailBookingCancelled(id, who as string).catch((e) => console.error("cancel email failed", e));
  revalidatePath("/", "layout");
  return { ok: true, message: tb("cancelled"), redirectTo: await dashUrl(user.role === "parent" ? "/dashboard/parent" : `/dashboard/${user.role}`) };
}

export async function rescheduleSession(_: FormState, data: FormData): Promise<FormState> {
  await requireUser(["parent"]);
  const te = await getTranslations("errors");
  const supabase = await createClient();
  const { data: newId, error } = await supabase.rpc("reschedule_booking", {
    p_booking: String(data.get("id") || ""),
    p_new_start: String(data.get("slot") || ""),
  });
  if (error) return { ok: false, message: te(errorKey(error.message)) };
  await emailBookingConfirmed(newId as string).catch(() => {});
  revalidatePath("/", "layout");
  return { ok: true, redirectTo: await dashUrl(`/dashboard/parent/sessions/${newId}?booked=1`) };
}

/** Tutor adds or changes the video link for an online session. */
export async function saveMeetingLink(_: FormState, data: FormData): Promise<FormState> {
  await requireUser(["tutor"]);
  const t = await getTranslations("tutor");
  const link = String(data.get("meeting_link") || "").trim();
  if (link && !/^https:\/\/\S+$/.test(link)) return { ok: false, message: t("linkRule") };
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("bookings")
    .update({ meeting_link: link || null })
    .eq("id", String(data.get("id")))
    .select("id");
  if (error || !rows?.length) return { ok: false, message: t("saveFailed") };
  revalidatePath("/", "layout");
  return { ok: true, message: t("saved") };
}

/** Tutor writes the after-session note (parents and students can read it). */
export async function saveSessionNote(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser(["tutor"]);
  const t = await getTranslations("tutor");
  const booking = String(data.get("booking_id") || "");
  const worked_on = String(data.get("worked_on") || "").trim();
  const practice = String(data.get("practice") || "").trim();
  if (!worked_on) return { ok: false, message: t("noteRequired") };
  const supabase = await createClient();
  const { data: b } = await supabase.from("bookings").select("student_id").eq("id", booking).eq("tutor_id", user.id).maybeSingle();
  if (!b) return { ok: false, message: t("saveFailed") };
  const { error } = await supabase
    .from("session_notes")
    .upsert({ booking_id: booking, tutor_id: user.id, student_id: b.student_id, worked_on: worked_on.slice(0, 2000), practice: practice.slice(0, 2000), updated_at: new Date().toISOString() }, { onConflict: "booking_id" });
  if (error) return { ok: false, message: t("saveFailed") };
  revalidatePath("/", "layout");
  return { ok: true, message: t("noteSaved") };
}
