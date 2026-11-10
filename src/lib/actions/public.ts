"use server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { checkSpam } from "@/lib/spam";
import { adminInbox, sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "@/components/forms/ActionForm";
import { site } from "@/config/site";

/**
 * Public form handlers (no login needed). Each one:
 *   1. checks for spam, 2. validates the input, 3. saves it in the database,
 *   4. emails the business inbox.
 */

const email = z.string().trim().email().max(200);
const shortText = (max: number) => z.string().trim().min(1).max(max);

async function save(table: string, row: Record<string, unknown>) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.info(`[${table}] database not configured, would save:`, row);
    return true;
  }
  const { error } = await createAdminClient().from(table).insert(row);
  if (error) console.error(`insert ${table} failed`, error.message);
  return !error;
}

function list(data: FormData, name: string) {
  return data.getAll(name).map(String).filter(Boolean);
}

export async function submitContact(_: FormState, data: FormData): Promise<FormState> {
  const tc = await getTranslations("common");
  if (!(await checkSpam("contact", data))) return { ok: false, message: tc("spamBlocked") };
  const parsed = z
    .object({ name: shortText(100), email, message: shortText(4000) })
    .safeParse({ name: data.get("name"), email: data.get("email"), message: data.get("message") });
  if (!parsed.success) return { ok: false, message: tc("genericError") };
  if (!(await save("contact_messages", parsed.data))) return { ok: false, message: tc("genericError") };
  await sendEmail({
    to: adminInbox(),
    subject: `New message from ${parsed.data.name}`,
    text: `${parsed.data.message}\n\nReply to: ${parsed.data.email}`,
  });
  return { ok: true };
}

export async function submitTutorApplication(_: FormState, data: FormData): Promise<FormState> {
  const tc = await getTranslations("common");
  const t = await getTranslations("volunteer");
  if (!(await checkSpam("apply", data, 3, 3600))) return { ok: false, message: tc("spamBlocked") };
  const parsed = z
    .object({
      name: shortText(100),
      email,
      subjects: z.array(z.enum(site.subjects)).min(1),
      grades: z.string().trim().max(100),
      availability: z.string().trim().max(1000),
      why: z.string().trim().max(3000),
      age_ok: z.literal("yes"),
    })
    .safeParse({
      name: data.get("name"),
      email: data.get("email"),
      subjects: list(data, "subjects"),
      grades: data.get("grades") ?? "",
      availability: data.get("availability") ?? "",
      why: data.get("why") ?? "",
      age_ok: data.get("age_ok"),
    });
  if (!parsed.success) return { ok: false, message: t("error") };
  const { age_ok: _age, ...row } = parsed.data;
  if (!(await save("tutor_applications", row))) return { ok: false, message: tc("genericError") };
  await sendEmail({
    to: adminInbox(),
    subject: `New tutor application: ${row.name}`,
    text: `Name: ${row.name}\nEmail: ${row.email}\nSubjects: ${row.subjects.join(", ")}\nGrades: ${row.grades}\nAvailability: ${row.availability}\n\nWhy: ${row.why}\n\nReview it in the admin dashboard.`,
  });
  return { ok: true };
}

export async function submitHelpRequest(_: FormState, data: FormData): Promise<FormState> {
  const tc = await getTranslations("common");
  if (!(await checkSpam("help", data))) return { ok: false, message: tc("spamBlocked") };
  const parsed = z
    .object({
      student_name: shortText(40),
      contact_email: email,
      grade: z.enum(site.grades),
      subject: z.enum(site.subjects),
      description: shortText(3000),
    })
    .safeParse({
      student_name: data.get("student_name"),
      contact_email: data.get("contact_email"),
      grade: data.get("grade"),
      subject: data.get("subject"),
      description: data.get("description"),
    });
  if (!parsed.success) return { ok: false, message: tc("genericError") };
  if (!(await save("help_requests", parsed.data))) return { ok: false, message: tc("genericError") };
  await sendEmail({
    to: adminInbox(),
    subject: `Homework help request (${parsed.data.subject}, grade ${parsed.data.grade})`,
    text: `${parsed.data.description}\n\nAnswer it from the tutor dashboard.`,
  });
  return { ok: true };
}
