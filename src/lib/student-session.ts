import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { Student } from "@/lib/types";

/** For pages used by a logged-in STUDENT: returns their own student record. */
export async function requireStudent() {
  const user = await requireUser(["student"]);
  const supabase = await createClient();
  const { data } = await supabase.from("students").select("*").eq("user_id", user.id).maybeSingle();
  if (!data) notFound();
  return { user, student: data as Student, supabase };
}
