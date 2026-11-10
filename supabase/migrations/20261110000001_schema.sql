-- =====================================================================
-- 1. TABLES
-- Every table has Row Level Security turned on (see the next migration).
-- Student data is kept to the minimum: nickname, grade, subjects.
-- =====================================================================

create extension if not exists btree_gist;  -- needed to block double-booking

create type public.user_role as enum ('admin', 'tutor', 'parent', 'student');

-- Grades as numbers for comparisons (K = 0).
create or replace function public.grade_num(g text) returns int
language sql immutable as $$
  select case when g = 'K' then 0 when g ~ '^[0-9]{1,2}$' then g::int else null end
$$;

-- ---------- People ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'parent',
  display_name text not null default '' check (char_length(display_name) <= 80),
  email text,                                   -- null for students (no email needed)
  approved boolean not null default false,      -- tutors must be approved by an admin
  preferred_locale text not null default 'en',
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,  -- the child's own login, if any
  username text unique check (username ~ '^[a-z0-9_]{3,24}$'),
  nickname text not null check (char_length(nickname) between 1 and 40),
  grade text not null check (public.grade_num(grade) between 0 and 12),
  subjects text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.students(parent_id);

create table public.tutor_profiles (
  tutor_id uuid primary key references public.profiles(id) on delete cascade,
  public_name text not null default '' check (char_length(public_name) <= 80),
  bio text not null default '' check (char_length(bio) <= 1200),
  fun_fact text not null default '' check (char_length(fun_fact) <= 300),
  subjects text[] not null default '{}',
  grade_min smallint not null default 0 check (grade_min between 0 and 12),
  grade_max smallint not null default 12 check (grade_max between 0 and 12),
  grades text not null default 'K–12',          -- display text, e.g. "K–5"
  formats text[] not null default '{in_person,online}',
  languages text not null default 'English',
  photo_url text,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Which tutor works with which student. Tutors can ONLY see students listed here.
create table public.tutor_students (
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tutor_id, student_id)
);
create index on public.tutor_students(student_id);

-- ---------- Scheduling ----------
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  subjects text[] not null default '{}',
  modes text[] not null default '{in_person,online}',
  slot_minutes smallint not null default 60 check (slot_minutes between 15 and 180),
  check (end_time > start_time)
);
create index on public.availability_rules(tutor_id);

create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  block_date date not null,
  reason text check (char_length(reason) <= 200),
  unique (tutor_id, block_date)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  mode text not null check (mode in ('in_person', 'online')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text check (char_length(note) <= 1000),
  is_intro boolean not null default false,
  status text not null default 'booked' check (status in ('booked', 'cancelled', 'completed')),
  meeting_link text check (meeting_link is null or meeting_link ~ '^https://'),
  cancelled_by public.user_role,
  cancel_reason text check (char_length(cancel_reason) <= 500),
  cancelled_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- DATABASE-LEVEL DOUBLE-BOOKING PROTECTION: a tutor (or a student) can never
  -- have two active bookings that overlap in time.
  constraint no_tutor_double_booking exclude using gist
    (tutor_id with =, tstzrange(starts_at, ends_at) with &&) where (status <> 'cancelled'),
  constraint no_student_double_booking exclude using gist
    (student_id with =, tstzrange(starts_at, ends_at) with &&) where (status <> 'cancelled')
);
create index on public.bookings(parent_id);
create index on public.bookings(tutor_id, starts_at);
create index on public.bookings(student_id);

create table public.session_notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  worked_on text not null check (char_length(worked_on) between 1 and 2000),
  practice text not null default '' check (char_length(practice) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.session_notes(student_id);

-- ---------- Assignments ----------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 150),
  instructions text not null default '' check (char_length(instructions) <= 5000),
  subject text not null,
  due_at timestamptz,
  attachment_paths text[] not null default '{}',   -- files in the private "assignment-files" bucket
  created_at timestamptz not null default now()
);
create index on public.assignments(tutor_id);

create table public.assignment_students (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  primary key (assignment_id, student_id)
);
create index on public.assignment_students(student_id);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  answer_text text not null default '' check (char_length(answer_text) <= 10000),
  file_paths text[] not null default '{}',          -- files in the private "submission-files" bucket
  status text not null default 'submitted' check (status in ('submitted', 'returned', 'complete')),
  feedback text check (char_length(feedback) <= 3000),
  score smallint check (score between 0 and 100),
  sticker text check (char_length(sticker) <= 16),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (assignment_id, student_id)
);
create index on public.submissions(student_id);

-- ---------- Quizzes ----------
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid references public.profiles(id) on delete cascade,  -- null = sample quiz in the shared library
  title text not null check (char_length(title) between 1 and 150),
  description text not null default '' check (char_length(description) <= 1000),
  subject text not null,
  grade_band text not null default '',
  allow_retries boolean not null default true,
  show_answers boolean not null default true,      -- show correct answers on the results screen
  instant_feedback boolean not null default true,  -- "Nice job!" / "Not quite" after each question
  time_limit_minutes smallint check (time_limit_minutes between 1 and 180),  -- null = no timer (default)
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.quizzes(tutor_id);

-- Question text and choices. Students CAN read this table (only for quizzes assigned to them).
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position smallint not null default 0,
  type text not null check (type in ('multiple_choice', 'multiple_select', 'true_false', 'short_answer', 'numeric', 'fill_blank', 'matching')),
  prompt text not null check (char_length(prompt) between 1 and 2000),
  image_url text,
  choices jsonb not null default '[]',   -- see src/lib/quiz/types.ts for the shape
  hint text check (char_length(hint) <= 500),
  points smallint not null default 1 check (points between 0 and 100)
);
create index on public.quiz_questions(quiz_id, position);

-- The ANSWER KEY lives in its own table that students can never read.
create table public.quiz_question_keys (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  answer jsonb not null,
  explanation text check (char_length(explanation) <= 2000)
);

create table public.quiz_assignments (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (quiz_id, student_id)
);
create index on public.quiz_assignments(student_id);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  responses jsonb not null default '{}',   -- { questionId: answer }   (saved as the student goes)
  results jsonb not null default '{}',     -- { questionId: { correct, earned } }  (written by the server only)
  current_index smallint not null default 0,
  score numeric(6,2),
  max_score numeric(6,2),
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);
create index on public.quiz_attempts(student_id);
create index on public.quiz_attempts(quiz_id);

-- ---------- Site content (edited by admins) ----------
-- Text in several languages is stored as JSON: {"en": "...", "es": "..."}
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  message jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question jsonb not null,
  answer jsonb not null,
  sort_order int not null default 0,
  show_on_home boolean not null default false,
  published boolean not null default true
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title jsonb not null,
  description jsonb not null default '{}',
  url text not null check (url ~ '^https?://'),
  subject text not null,
  grade_band text not null default 'K–12',
  sort_order int not null default 0,
  published boolean not null default true
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  quote jsonb not null,
  attribution text not null,
  is_placeholder boolean not null default false,
  sort_order int not null default 0,
  published boolean not null default true
);

create table public.site_settings (
  key text primary key,
  value jsonb not null
);
insert into public.site_settings(key, value) values ('cancel_window_hours', '12'), ('min_booking_lead_hours', '2');

-- ---------- Public form inboxes ----------
create table public.tutor_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subjects text[] not null default '{}',
  grades text not null default '',
  availability text not null default '',
  why text not null default '',
  status text not null default 'new' check (status in ('new', 'contacted', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.help_requests (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  contact_email text not null,
  grade text not null,
  subject text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  handled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Spam protection: counts form submissions per (hashed) visitor.
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);
