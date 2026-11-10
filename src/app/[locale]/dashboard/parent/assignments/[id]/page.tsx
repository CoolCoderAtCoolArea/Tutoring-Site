import { notFound } from "next/navigation";
import { AssignmentView } from "@/components/dashboard/AssignmentView";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Assignment, Submission } from "@/lib/types";

/** Parents see exactly what their child sees (and can turn work in for younger kids). */
export default async function ParentAssignment({ params, searchParams }: {
  params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ student?: string }>;
}) {
  const { locale, id } = await params;
  const { student } = await searchParams;
  const user = await requireUser(["parent"]);
  const supabase = await createClient();
  const { data: kid } = await supabase.from("students").select("id").eq("id", student ?? "").eq("parent_id", user.id).maybeSingle();
  const { data: a } = await supabase.from("assignments").select("*").eq("id", id).maybeSingle();
  if (!kid || !a) notFound();
  const { data: s } = await supabase.from("submissions").select("*").eq("assignment_id", id).eq("student_id", kid.id).maybeSingle();
  return <AssignmentView assignment={a as Assignment} submission={s as Submission | null} studentId={kid.id} locale={locale} />;
}
