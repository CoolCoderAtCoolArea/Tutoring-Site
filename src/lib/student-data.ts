import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Assignment, Booking, Quiz, QuizAttempt, SessionNote, Student, Submission } from "@/lib/types";
import { earnedBadges, weekStreak, type Badge } from "@/lib/progress";

/**
 * Everything a parent or student dashboard shows about one or more students.
 * Uses the logged-in user's client, so Row Level Security limits the data.
 */
export type AssignmentItem = Assignment & { student_id: string; submission: Submission | null };
export type QuizItem = Quiz & { student_id: string; attempts: QuizAttempt[]; best: number | null; inProgress: QuizAttempt | null };
export type StudentOverview = {
  student: Student;
  upcoming: Booking[];
  past: Booking[];
  notes: (SessionNote & { starts_at?: string; subject?: string })[];
  assignments: AssignmentItem[];
  quizzes: QuizItem[];
  badges: Badge[];
  streak: number;
};

export async function loadOverview(supabase: SupabaseClient, students: Student[]): Promise<StudentOverview[]> {
  if (!students.length) return [];
  const ids = students.map((s) => s.id);
  const now = new Date().toISOString();
  const [bookings, notes, assignmentLinks, submissions, quizLinks, attempts] = await Promise.all([
    supabase.from("bookings").select("*").in("student_id", ids).order("starts_at"),
    supabase.from("session_notes").select("*").in("student_id", ids).order("created_at", { ascending: false }),
    supabase.from("assignment_students").select("student_id, assignments(*)").in("student_id", ids),
    supabase.from("submissions").select("*").in("student_id", ids),
    supabase.from("quiz_assignments").select("student_id, quizzes(*)").in("student_id", ids),
    supabase.from("quiz_attempts").select("*").in("student_id", ids).order("started_at", { ascending: false }),
  ]);
  const allBookings = (bookings.data ?? []) as Booking[];
  const allSubs = (submissions.data ?? []) as Submission[];
  const allAttempts = (attempts.data ?? []) as QuizAttempt[];

  return students.map((student) => {
    const mine = allBookings.filter((b) => b.student_id === student.id);
    const upcoming = mine.filter((b) => b.status === "booked" && b.ends_at >= now);
    const past = mine.filter((b) => b.status !== "booked" || b.ends_at < now).reverse();
    const myNotes = ((notes.data ?? []) as SessionNote[])
      .filter((n) => n.student_id === student.id)
      .map((n) => {
        const b = mine.find((x) => x.id === n.booking_id);
        return { ...n, starts_at: b?.starts_at, subject: b?.subject };
      });

    const assignments: AssignmentItem[] = ((assignmentLinks.data ?? []) as unknown as { student_id: string; assignments: Assignment }[])
      .filter((l) => l.student_id === student.id && l.assignments)
      .map((l) => ({ ...l.assignments, student_id: student.id, submission: allSubs.find((s) => s.assignment_id === l.assignments.id && s.student_id === student.id) ?? null }))
      .sort((a, b) => (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"));

    const quizzes: QuizItem[] = ((quizLinks.data ?? []) as unknown as { student_id: string; quizzes: Quiz }[])
      .filter((l) => l.student_id === student.id && l.quizzes)
      .map((l) => {
        const at = allAttempts.filter((a) => a.quiz_id === l.quizzes.id && a.student_id === student.id);
        const done = at.filter((a) => a.status === "submitted" && a.max_score);
        const best = done.length ? Math.max(...done.map((a) => Math.round((Number(a.score) / Number(a.max_score)) * 100))) : null;
        return { ...l.quizzes, student_id: student.id, attempts: at, best, inProgress: at.find((a) => a.status === "in_progress") ?? null };
      });

    const doneAttempts = allAttempts.filter((a) => a.student_id === student.id && a.status === "submitted");
    const doneSubs = allSubs.filter((s) => s.student_id === student.id);
    const doneSessions = mine.filter((b) => b.status === "completed");
    const activity = {
      quizzesDone: doneAttempts.length,
      perfectQuizzes: doneAttempts.filter((a) => a.max_score && Number(a.score) === Number(a.max_score)).length,
      assignmentsDone: doneSubs.length,
      sessionsDone: doneSessions.length,
      activeDates: [
        ...doneAttempts.map((a) => a.submitted_at!),
        ...doneSubs.map((s) => s.submitted_at),
        ...doneSessions.map((b) => b.starts_at),
      ].filter(Boolean),
    };
    return { student, upcoming, past, notes: myNotes, assignments, quizzes, badges: earnedBadges(activity), streak: weekStreak(activity.activeDates) };
  });
}
