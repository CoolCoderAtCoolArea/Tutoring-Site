/** Shapes of database rows used across the dashboards. */
export type Student = {
  id: string;
  parent_id: string;
  user_id: string | null;
  username: string | null;
  nickname: string;
  grade: string;
  subjects: string[];
};

export type Booking = {
  id: string;
  student_id: string;
  parent_id: string;
  tutor_id: string;
  subject: string;
  mode: "in_person" | "online";
  starts_at: string;
  ends_at: string;
  note: string | null;
  is_intro: boolean;
  status: "booked" | "cancelled" | "completed";
  meeting_link: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
};

export type SessionNote = { id: string; booking_id: string; student_id: string; tutor_id: string; worked_on: string; practice: string; created_at: string };

export type Assignment = {
  id: string;
  tutor_id: string;
  title: string;
  instructions: string;
  subject: string;
  due_at: string | null;
  attachment_paths: string[];
  created_at: string;
};

export type Submission = {
  id: string;
  assignment_id: string;
  student_id: string;
  answer_text: string;
  file_paths: string[];
  status: "submitted" | "returned" | "complete";
  feedback: string | null;
  score: number | null;
  sticker: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

export type Quiz = {
  id: string;
  tutor_id: string | null;
  title: string;
  description: string;
  subject: string;
  grade_band: string;
  allow_retries: boolean;
  show_answers: boolean;
  instant_feedback: boolean;
  time_limit_minutes: number | null;
  due_at: string | null;
};

export type QuizAttempt = {
  id: string;
  quiz_id: string;
  student_id: string;
  status: "in_progress" | "submitted";
  responses: Record<string, unknown>;
  results: Record<string, { correct: boolean; earned: number }>;
  current_index: number;
  score: number | null;
  max_score: number | null;
  started_at: string;
  submitted_at: string | null;
};
