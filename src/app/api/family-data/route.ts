import { createClient } from "@/lib/supabase/server";

/**
 * "Download my family's data": everything we store about this parent and
 * their children, as a JSON file. Uses the parent's own login (RLS).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Please log in.", { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("display_name, email, preferred_locale, created_at, role").eq("id", user.id).single();
  if (profile?.role !== "parent") return new Response("Only parent accounts can download family data.", { status: 403 });
  const { data: students } = await supabase.from("students").select("id, nickname, grade, subjects, username, created_at").eq("parent_id", user.id);
  const ids = (students ?? []).map((s) => s.id);
  const pick = async (table: string, cols = "*") => (ids.length ? (await supabase.from(table).select(cols).in("student_id", ids)).data ?? [] : []);
  const body = {
    exported_at: new Date().toISOString(),
    parent: profile,
    children: students,
    bookings: await pick("bookings", "id, student_id, subject, mode, starts_at, ends_at, note, status, cancel_reason, is_intro, created_at"),
    session_notes: await pick("session_notes", "student_id, worked_on, practice, created_at"),
    assignment_submissions: await pick("submissions", "assignment_id, student_id, answer_text, file_paths, status, feedback, score, sticker, submitted_at"),
    quiz_attempts: await pick("quiz_attempts", "quiz_id, student_id, status, responses, score, max_score, started_at, submitted_at"),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="family-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
