"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, studentEmail } from "@/lib/auth";
import { site } from "@/config/site";
import type { FormState } from "@/components/forms/ActionForm";
import { deleteStudentFiles } from "@/lib/files";

const childSchema = z.object({
  nickname: z.string().trim().min(1).max(40),
  grade: z.enum(site.grades),
  subjects: z.array(z.enum(site.subjects)),
});

function readChild(data: FormData) {
  return childSchema.safeParse({
    nickname: data.get("nickname"),
    grade: data.get("grade"),
    subjects: data.getAll("subjects").map(String),
  });
}

export async function addChild(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser(["parent"]);
  const t = await getTranslations("parent");
  const parsed = readChild(data);
  if (!parsed.success) return { ok: false, message: t("childInvalid") };
  const supabase = await createClient();
  const { error } = await supabase.from("students").insert({ ...parsed.data, parent_id: user.id });
  if (error) return { ok: false, message: t("childInvalid") };
  revalidatePath("/", "layout");
  return { ok: true, message: t("childAdded") };
}

export async function updateChild(_: FormState, data: FormData): Promise<FormState> {
  await requireUser(["parent"]);
  const t = await getTranslations("parent");
  const parsed = readChild(data);
  if (!parsed.success) return { ok: false, message: t("childInvalid") };
  const supabase = await createClient();
  // RLS makes sure this only works on the parent's own child.
  const { data: rows, error } = await supabase.from("students").update(parsed.data).eq("id", String(data.get("id"))).select("id");
  if (error || !rows?.length) return { ok: false, message: t("childInvalid") };
  revalidatePath("/", "layout");
  return { ok: true, message: t("saved") };
}

/** Check (with RLS) that this child belongs to the logged-in parent. */
async function ownChild(studentId: string) {
  const user = await requireUser(["parent"]);
  const supabase = await createClient();
  const { data } = await supabase.from("students").select("id, nickname, user_id, username, parent_id").eq("id", studentId).eq("parent_id", user.id).maybeSingle();
  return data;
}

/**
 * Give a child their own simple login (username + PIN, no email).
 * Uses the admin client because creating logins needs the service role key.
 */
export async function createChildLogin(_: FormState, data: FormData): Promise<FormState> {
  const t = await getTranslations("parent");
  const child = await ownChild(String(data.get("id")));
  if (!child) return { ok: false, message: t("childInvalid") };
  const username = String(data.get("username") || "").trim().toLowerCase();
  const pin = String(data.get("pin") || "");
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return { ok: false, message: t("usernameRule") };
  if (!/^\d{6,12}$/.test(pin) && pin.length < 8) return { ok: false, message: t("pinRule") };

  const adminDb = createAdminClient();
  if (child.user_id) {
    // Already has a login: just change the PIN.
    const { error } = await adminDb.auth.admin.updateUserById(child.user_id, { password: pin });
    return error ? { ok: false, message: t("loginFailed") } : { ok: true, message: t("pinChanged") };
  }
  const { data: taken } = await adminDb.from("students").select("id").eq("username", username).maybeSingle();
  if (taken) return { ok: false, message: t("usernameTaken") };

  const { data: created, error } = await adminDb.auth.admin.createUser({
    email: studentEmail(username),
    password: pin,
    email_confirm: true,
    app_metadata: { role: "student" }, // only the server can set this
    user_metadata: { display_name: child.nickname },
  });
  if (error || !created.user) return { ok: false, message: error?.message.includes("already") ? t("usernameTaken") : t("loginFailed") };
  const { error: linkError } = await adminDb.from("students").update({ user_id: created.user.id, username }).eq("id", child.id);
  if (linkError) {
    await adminDb.auth.admin.deleteUser(created.user.id);
    return { ok: false, message: t("loginFailed") };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: t("loginCreated", { username }) };
}

export async function removeChildLogin(data: FormData) {
  const child = await ownChild(String(data.get("id")));
  if (!child?.user_id) return;
  const adminDb = createAdminClient();
  await adminDb.from("students").update({ username: null }).eq("id", child.id);
  await adminDb.auth.admin.deleteUser(child.user_id); // students.user_id becomes null automatically
  revalidatePath("/", "layout");
}

export async function removeChild(data: FormData) {
  const child = await ownChild(String(data.get("id")));
  if (!child) return;
  const adminDb = createAdminClient();
  await deleteStudentFiles(child.id);
  if (child.user_id) await adminDb.auth.admin.deleteUser(child.user_id);
  await adminDb.from("students").delete().eq("id", child.id);
  revalidatePath("/", "layout");
}

/**
 * Deletes the WHOLE family account: every child, their logins, uploaded
 * files, sessions, notes, quiz answers, and the parent's own account.
 * Requires typing DELETE to confirm.
 */
export async function deleteFamilyData(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser(["parent"]);
  const t = await getTranslations("parent");
  if (String(data.get("confirm") || "").trim().toUpperCase() !== "DELETE") return { ok: false, message: t("typeDelete") };
  const supabase = await createClient();
  const { data: kids } = await supabase.from("students").select("id, user_id").eq("parent_id", user.id);
  const adminDb = createAdminClient();
  for (const k of kids ?? []) {
    await deleteStudentFiles(k.id);
    if (k.user_id) await adminDb.auth.admin.deleteUser(k.user_id);
  }
  // Deleting the parent's login removes their profile, children, bookings,
  // notes, submissions and attempts too (ON DELETE CASCADE in the database).
  const { error } = await adminDb.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, message: t("deleteFailed") };
  await supabase.auth.signOut();
  return { ok: true, message: t("deleted"), redirectTo: "/" };
}
