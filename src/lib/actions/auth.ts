"use server";
import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { checkSpam } from "@/lib/spam";
import { siteUrl } from "@/config/site";
import { studentEmail } from "@/lib/auth";
import type { FormState } from "@/components/forms/ActionForm";

async function localePath(path: string) {
  const locale = await getLocale();
  return locale === "en" ? path : `/${locale}${path}`;
}

export async function signIn(_: FormState, data: FormData): Promise<FormState> {
  const t = await getTranslations("auth");
  if (!isSupabaseConfigured()) return { ok: false, message: t("notConfigured") };
  const parsed = z.object({ email: z.string().trim().email(), password: z.string().min(1) }).safeParse({
    email: data.get("email"),
    password: data.get("password"),
  });
  if (!parsed.success) return { ok: false, message: t("badLogin") };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: error.message.includes("confirm") ? t("confirmFirst") : t("badLogin") };
  return { ok: true, redirectTo: await localePath(String(data.get("next") || "/dashboard")) };
}

/** Kids log in with a username + PIN that their parent made. */
export async function studentSignIn(_: FormState, data: FormData): Promise<FormState> {
  const t = await getTranslations("auth");
  if (!isSupabaseConfigured()) return { ok: false, message: t("notConfigured") };
  if (!(await checkSpam("student-login", data, 10, 600))) return { ok: false, message: t("tooMany") };
  const username = String(data.get("username") || "").trim().toLowerCase();
  const pin = String(data.get("pin") || "");
  if (!/^[a-z0-9_]{3,24}$/.test(username) || pin.length < 6) return { ok: false, message: t("badStudentLogin") };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: studentEmail(username), password: pin });
  if (error) return { ok: false, message: t("badStudentLogin") };
  return { ok: true, redirectTo: await localePath("/dashboard/student") };
}

export async function signUp(_: FormState, data: FormData): Promise<FormState> {
  const t = await getTranslations("auth");
  if (!isSupabaseConfigured()) return { ok: false, message: t("notConfigured") };
  if (!(await checkSpam("signup", data, 5, 3600))) return { ok: false, message: t("tooMany") };
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(80),
      email: z.string().trim().email().max(200),
      password: z.string().min(8).max(72),
      role: z.enum(["parent", "tutor"]),
      agree: z.literal("yes"),
    })
    .safeParse({
      name: data.get("name"),
      email: data.get("email"),
      password: data.get("password"),
      role: data.get("role") || "parent",
      agree: data.get("agree"),
    });
  if (!parsed.success) {
    const errors: string[] = [];
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      if (field === "password") errors.push(t("passwordRule"));
      else if (field === "email") errors.push(t("emailRule"));
      else if (field === "agree") errors.push(t("agreeRule"));
      else if (field === "name") errors.push(t("nameRule"));
    }
    return { ok: false, message: t("fixErrors"), errors: [...new Set(errors)] };
  }
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: result, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Only "parent" or "tutor" can be chosen here. The database ignores anything else.
      data: { display_name: parsed.data.name, role: parsed.data.role, locale },
      emailRedirectTo: siteUrl(`/auth/callback?next=${encodeURIComponent(await localePath("/dashboard"))}`),
    },
  });
  if (error) return { ok: false, message: error.message.toLowerCase().includes("registered") ? t("emailTaken") : t("signupFailed") };
  // If email confirmation is ON (recommended), there's no session yet.
  if (!result.session) return { ok: true, message: t("checkEmail") };
  return { ok: true, redirectTo: await localePath("/dashboard") };
}

export async function requestPasswordReset(_: FormState, data: FormData): Promise<FormState> {
  const t = await getTranslations("auth");
  if (!isSupabaseConfigured()) return { ok: false, message: t("notConfigured") };
  if (!(await checkSpam("reset", data, 3, 3600))) return { ok: false, message: t("tooMany") };
  const email = String(data.get("email") || "").trim();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: siteUrl(`/auth/callback?next=${encodeURIComponent(await localePath("/reset-password"))}`),
  });
  // Same message either way, so nobody can test which emails have accounts.
  return { ok: true, message: t("resetSent") };
}

export async function updatePassword(_: FormState, data: FormData): Promise<FormState> {
  const t = await getTranslations("auth");
  const password = String(data.get("password") || "");
  if (password.length < 8) return { ok: false, message: t("passwordRule") };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: t("resetFailed") };
  return { ok: true, message: t("passwordChanged"), redirectTo: await localePath("/dashboard") };
}

export async function signOut() {
  const locale = await getLocale();
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect({ href: "/", locale });
}
