"use server";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { errorKey } from "@/lib/errors";
import { locales } from "@/i18n/config";
import { deleteStudentFiles } from "@/lib/files";
import { sendEmail } from "@/lib/email";
import { site, siteUrl } from "@/config/site";
import type { FormState } from "@/components/forms/ActionForm";

/** Reads fields like question_en, question_es into {"en": "...", "es": "..."}. */
function localized(data: FormData, field: string) {
  return Object.fromEntries(locales.map((l) => [l, String(data.get(`${field}_${l}`) || "").trim()]).filter(([, v]) => v));
}

function done() {
  revalidatePath("/", "layout"); // refresh public pages that show this content
}

// ---------- Users ----------
export async function setUserRole(_: FormState, data: FormData): Promise<FormState> {
  await requireUser(["admin"]);
  const te = await getTranslations("errors");
  const t = await getTranslations("admin");
  const userId = String(data.get("id"));
  const role = String(data.get("role"));
  const approved = data.get("approved") === "yes";
  const supabase = await createClient();
  const { data: before } = await supabase.from("profiles").select("role, approved, email, display_name, preferred_locale").eq("id", userId).maybeSingle();
  const { error } = await supabase.rpc("admin_set_user", { p_user: userId, p_role: role, p_approved: approved });
  if (error) return { ok: false, message: te(errorKey(error.message)) };
  // Let a newly approved tutor know.
  if (before && role === "tutor" && approved && !before.approved && before.email) {
    const tt = await getTranslations({ locale: before.preferred_locale || "en", namespace: "admin" });
    await sendEmail({ to: before.email, subject: tt("approvedSubject", { site: site.name }), text: tt("approvedBody", { name: before.display_name, link: siteUrl("/dashboard/tutor/profile") }) });
  }
  done();
  return { ok: true, message: t("saved") };
}

export async function deleteUser(data: FormData) {
  const me = await requireUser(["admin"]);
  const id = String(data.get("id"));
  if (id === me.id) return;
  const admin = createAdminClient();
  const { data: kids } = await admin.from("students").select("id, user_id").eq("parent_id", id);
  for (const k of kids ?? []) {
    await deleteStudentFiles(k.id);
    if (k.user_id) await admin.auth.admin.deleteUser(k.user_id);
  }
  await admin.auth.admin.deleteUser(id);
  done();
}

/** Manually connect a tutor and a student (e.g. to hand a student to a new tutor). */
export async function linkTutorStudent(_: FormState, data: FormData): Promise<FormState> {
  await requireUser(["admin"]);
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("tutor_students").upsert({ tutor_id: String(data.get("tutor_id")), student_id: String(data.get("student_id")) }, { ignoreDuplicates: true }); // already linked = fine
  if (error) return { ok: false, message: t("saveFailed") };
  done();
  return { ok: true, message: t("saved") };
}

// ---------- Site content ----------
export async function saveAnnouncement(_: FormState, data: FormData): Promise<FormState> {
  await requireUser(["admin"]);
  const t = await getTranslations("admin");
  const message = localized(data, "message");
  if (!message.en) return { ok: false, message: t("needEnglish") };
  const supabase = await createClient();
  await supabase.from("announcements").update({ active: false }).eq("active", true); // only one banner at a time
  const { error } = await supabase.from("announcements").insert({ message, active: true });
  if (error) return { ok: false, message: t("saveFailed") };
  done();
  return { ok: true, message: t("bannerOn") };
}

export async function clearAnnouncement() {
  await requireUser(["admin"]);
  const supabase = await createClient();
  await supabase.from("announcements").update({ active: false }).eq("active", true);
  done();
}

const contentTables = {
  faqs: { fields: ["question", "answer"], extra: (d: FormData) => ({ show_on_home: d.get("show_on_home") === "yes" }) },
  resources: { fields: ["title", "description"], extra: (d: FormData) => ({ url: String(d.get("url") || ""), subject: String(d.get("subject") || "homework"), grade_band: String(d.get("grade_band") || "K–12") }) },
  testimonials: { fields: ["quote"], extra: (d: FormData) => ({ attribution: String(d.get("attribution") || ""), is_placeholder: d.get("is_placeholder") === "yes" }) },
} as const;

/** Add or update a FAQ, resource, or testimonial. */
export async function saveContent(_: FormState, data: FormData): Promise<FormState> {
  await requireUser(["admin"]);
  const t = await getTranslations("admin");
  const table = String(data.get("table")) as keyof typeof contentTables;
  const cfg = contentTables[table];
  if (!cfg) return { ok: false };
  const row: Record<string, unknown> = { ...cfg.extra(data), sort_order: Number(data.get("sort_order") || 0), published: data.get("published") !== "no" };
  for (const f of cfg.fields) row[f] = localized(data, f);
  if (!(row[cfg.fields[0]] as Record<string, string>).en) return { ok: false, message: t("needEnglish") };
  const supabase = await createClient();
  const id = String(data.get("id") || "");
  const { error } = id ? await supabase.from(table).update(row).eq("id", id) : await supabase.from(table).insert(row);
  if (error) return { ok: false, message: `${t("saveFailed")} (${error.message})` };
  done();
  return { ok: true, message: t("saved") };
}

export async function deleteContent(data: FormData) {
  await requireUser(["admin"]);
  const table = String(data.get("table"));
  if (!(table in contentTables)) return;
  const supabase = await createClient();
  await supabase.from(table).delete().eq("id", String(data.get("id")));
  done();
}

// ---------- Inbox ----------
export async function setApplicationStatus(data: FormData) {
  await requireUser(["admin"]);
  const supabase = await createClient();
  await supabase.from("tutor_applications").update({ status: String(data.get("status")) }).eq("id", String(data.get("id")));
  done();
}

export async function markMessageHandled(data: FormData) {
  await requireUser(["admin"]);
  const supabase = await createClient();
  await supabase.from("contact_messages").update({ handled: true }).eq("id", String(data.get("id")));
  done();
}
