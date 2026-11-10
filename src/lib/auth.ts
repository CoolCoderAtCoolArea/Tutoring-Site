import "server-only";
import { cache } from "react";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type Role = "admin" | "tutor" | "parent" | "student";

export type SessionUser = {
  id: string;
  role: Role;
  approved: boolean;
  display_name: string;
  email: string | null;
  preferred_locale: string;
};

/**
 * Student logins don't need a real email. Behind the scenes we give them a
 * made-up address on a reserved domain that can never receive mail.
 * The student only types their username + PIN.
 */
export const STUDENT_EMAIL_DOMAIN = "students.example.com";
export const studentEmail = (username: string) => `${username.toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;

/** The logged-in user and their profile, or null. Cached for one request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, role, approved, display_name, email, preferred_locale")
    .eq("id", user.id)
    .maybeSingle();
  return (data as SessionUser) ?? null;
});

/**
 * Use at the top of a dashboard page. Sends visitors who aren't logged in to
 * the login page, and people with the wrong role to their own dashboard.
 * Tutors who aren't approved yet go to the "waiting for approval" page.
 */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login", locale });
  if (user.role === "tutor" && !user.approved && roles?.includes("tutor")) {
    return redirect({ href: "/dashboard/pending", locale });
  }
  if (roles && !roles.includes(user.role)) return redirect({ href: dashboardPath(user.role), locale });
  return user;
}

export function dashboardPath(role: Role) {
  return `/dashboard/${role}`;
}
