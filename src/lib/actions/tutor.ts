"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { site } from "@/config/site";
import type { FormState } from "@/components/forms/ActionForm";

/** Add a weekly time block, e.g. every Tuesday 4–6pm. */
export async function addAvailability(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser(["tutor"]);
  const t = await getTranslations("tutor");
  const parsed = z
    .object({
      weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1),
      start_time: z.string().regex(/^\d{2}:\d{2}$/),
      end_time: z.string().regex(/^\d{2}:\d{2}$/),
      subjects: z.array(z.enum(site.subjects)).min(1),
      modes: z.array(z.enum(["in_person", "online"])).min(1),
      slot_minutes: z.coerce.number().int().min(15).max(180),
    })
    .safeParse({
      weekdays: data.getAll("weekdays"),
      start_time: data.get("start_time"),
      end_time: data.get("end_time"),
      subjects: data.getAll("subjects"),
      modes: data.getAll("modes"),
      slot_minutes: data.get("slot_minutes") || site.sessionMinutes,
    });
  if (!parsed.success || parsed.data.end_time <= parsed.data.start_time) return { ok: false, message: t("availabilityInvalid") };
  const { weekdays, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("availability_rules").insert(weekdays.map((weekday) => ({ ...rest, weekday, tutor_id: user.id })));
  if (error) return { ok: false, message: t("saveFailed") };
  revalidatePath("/", "layout");
  return { ok: true, message: t("saved") };
}

export async function deleteAvailability(data: FormData) {
  await requireUser(["tutor"]);
  const supabase = await createClient();
  await supabase.from("availability_rules").delete().eq("id", String(data.get("id")));
  revalidatePath("/", "layout");
}

/** Block a specific date (vacation, test day, etc). */
export async function addBlock(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser(["tutor"]);
  const t = await getTranslations("tutor");
  const date = String(data.get("block_date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: t("availabilityInvalid") };
  const supabase = await createClient();
  const { error } = await supabase
    .from("availability_blocks")
    .upsert({ tutor_id: user.id, block_date: date, reason: String(data.get("reason") || "").slice(0, 200) || null }, { onConflict: "tutor_id,block_date" });
  if (error) return { ok: false, message: t("saveFailed") };
  revalidatePath("/", "layout");
  return { ok: true, message: t("blockSaved") };
}

export async function deleteBlock(data: FormData) {
  await requireUser(["tutor"]);
  const supabase = await createClient();
  await supabase.from("availability_blocks").delete().eq("id", String(data.get("id")));
  revalidatePath("/", "layout");
}

/** Tutors edit their public "Meet the Tutors" card. Unapproved tutors can fill it in while they wait. */
export async function saveTutorProfile(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "tutor" && user.role !== "admin") return { ok: false };
  const t = await getTranslations("tutor");
  const gradeMin = site.grades.indexOf(String(data.get("grade_min")) as never);
  const gradeMax = site.grades.indexOf(String(data.get("grade_max")) as never);
  const parsed = z
    .object({
      public_name: z.string().trim().min(1).max(80),
      bio: z.string().trim().max(1200),
      fun_fact: z.string().trim().max(300),
      subjects: z.array(z.enum(site.subjects)),
      formats: z.array(z.enum(["in_person", "online"])).min(1),
      languages: z.string().trim().max(100),
      photo_url: z.union([z.literal(""), z.string().url().startsWith("https://")]),
    })
    .safeParse({
      public_name: data.get("public_name"),
      bio: data.get("bio") ?? "",
      fun_fact: data.get("fun_fact") ?? "",
      subjects: data.getAll("subjects"),
      formats: data.getAll("formats"),
      languages: data.get("languages") ?? "",
      photo_url: data.get("photo_url") ?? "",
    });
  if (!parsed.success || gradeMin < 0 || gradeMax < gradeMin) return { ok: false, message: t("profileInvalid") };
  const g = (i: number) => site.grades[i];
  const supabase = await createClient();
  const { error } = await supabase
    .from("tutor_profiles")
    .update({
      ...parsed.data,
      photo_url: parsed.data.photo_url || null,
      grade_min: gradeMin,
      grade_max: gradeMax,
      grades: gradeMin === gradeMax ? g(gradeMin) : `${g(gradeMin)}–${g(gradeMax)}`,
      published: data.get("published") === "yes",
      updated_at: new Date().toISOString(),
    })
    .eq("tutor_id", user.id);
  if (error) return { ok: false, message: t("saveFailed") };
  revalidatePath("/", "layout");
  return { ok: true, message: t("saved") };
}
