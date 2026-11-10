import { notFound } from "next/navigation";
import { AssignmentView } from "@/components/dashboard/AssignmentView";
import { requireStudent } from "@/lib/student-session";
import type { Assignment, Submission } from "@/lib/types";

export default async function StudentAssignment({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const { student, supabase } = await requireStudent();
  const { data: a } = await supabase.from("assignments").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();
  const { data: s } = await supabase.from("submissions").select("*").eq("assignment_id", id).eq("student_id", student.id).maybeSingle();
  return <AssignmentView assignment={a as Assignment} submission={s as Submission | null} studentId={student.id} locale={locale} />;
}
