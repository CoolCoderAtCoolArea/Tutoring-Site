-- =====================================================================
-- 2. SECURITY: new-user setup, helper functions, Row Level Security.
--
-- How to read a policy:
--   "using (...)"      = which existing rows this user may see/change
--   "with check (...)" = which new/changed rows this user may save
-- If no policy allows something, it is BLOCKED. RLS is on for every table.
-- =====================================================================

-- ---------- When someone signs up, create their profile ----------
-- Role comes from sign-up info, but nobody can make themselves an admin:
--   * "student" only if set by our server (app_metadata, which users can't edit)
--   * "tutor" if they chose it (they still need admin approval)
--   * everyone else is a "parent"
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r public.user_role;
begin
  if new.raw_app_meta_data ->> 'role' = 'student' then r := 'student';
  elsif new.raw_user_meta_data ->> 'role' = 'tutor' then r := 'tutor';
  else r := 'parent';
  end if;

  insert into public.profiles (id, role, display_name, email, approved, preferred_locale)
  values (
    new.id, r,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80),
    case when r = 'student' then null else new.email end,
    r in ('parent', 'student'),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'en')
  );

  if r = 'tutor' then
    insert into public.tutor_profiles (tutor_id, public_name)
    values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80));
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Helper functions used by the policies ----------
-- "security definer" lets these look up roles without being blocked by RLS
-- themselves. They only ever answer yes/no about the CURRENT user.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.is_approved_tutor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'tutor' and approved)
$$;

create or replace function public.is_approved_tutor_id(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = uid and role = 'tutor' and approved)
$$;

-- The student record that belongs to the logged-in student (if they are one).
create or replace function public.my_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from students where user_id = auth.uid()
$$;

create or replace function public.is_parent_of(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from students where id = sid and parent_id = auth.uid())
$$;

-- An APPROVED tutor who is assigned to this student.
create or replace function public.tutor_has_student(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_approved_tutor()
     and exists (select 1 from tutor_students where tutor_id = auth.uid() and student_id = sid)
$$;

-- The child themself, their parent, their assigned tutor, or an admin.
create or replace function public.can_view_student(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from students s where s.id = sid and (s.parent_id = auth.uid() or s.user_id = auth.uid()))
      or public.tutor_has_student(sid)
$$;

-- The child or their parent (people who may act FOR the student).
create or replace function public.is_student_or_parent(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from students s where s.id = sid and (s.parent_id = auth.uid() or s.user_id = auth.uid()))
$$;

create or replace function public.owns_assignment(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_approved_tutor() and exists (select 1 from assignments where id = aid and tutor_id = auth.uid())
$$;

create or replace function public.owns_quiz(qid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_approved_tutor() and exists (select 1 from quizzes where id = qid and tutor_id = auth.uid())
$$;

-- Can this user see this quiz? Owner, admin, any approved tutor for library quizzes,
-- or the student/parent it is assigned to.
create or replace function public.can_view_quiz(qid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or public.owns_quiz(qid)
      or (public.is_approved_tutor() and exists (select 1 from quizzes where id = qid and tutor_id is null))
      or exists (select 1 from quiz_assignments qa where qa.quiz_id = qid and public.is_student_or_parent(qa.student_id))
$$;

-- Lock helper functions down: only logged-in users (and the server) may call them.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.grade_num(text) to anon, authenticated;
grant execute on function public.is_admin(), public.is_approved_tutor(), public.is_approved_tutor_id(uuid),
  public.my_student_id(), public.is_parent_of(uuid), public.tutor_has_student(uuid), public.can_view_student(uuid),
  public.is_student_or_parent(uuid), public.owns_assignment(uuid), public.owns_quiz(uuid), public.can_view_quiz(uuid)
  to authenticated;
-- anon needs this one for the public tutor list policy:
grant execute on function public.is_approved_tutor_id(uuid), public.is_admin() to anon;

-- ---------- Turn on RLS everywhere ----------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Start from "no access" and grant only what is needed.
revoke all on all tables in schema public from anon, authenticated;

-- ---------- profiles ----------
grant select on public.profiles to authenticated;
grant update (display_name, preferred_locale) on public.profiles to authenticated;  -- NOT role/approved
create policy "see own profile, admins see all" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin()
    -- tutors can see the parent of a student they work with (to know who to contact)
    or exists (select 1 from students s where s.parent_id = profiles.id and public.tutor_has_student(s.id)));
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- students ----------
grant select on public.students to authenticated;
grant insert (parent_id, nickname, grade, subjects) on public.students to authenticated;
grant update (nickname, grade, subjects) on public.students to authenticated;
grant delete on public.students to authenticated;
create policy "view students you may see" on public.students for select to authenticated
  -- (parent_id/user_id are checked directly too, so a just-added child is visible right away)
  using (parent_id = auth.uid() or user_id = auth.uid() or public.can_view_student(id));
create policy "parents add their own children" on public.students for insert to authenticated
  with check (parent_id = auth.uid() and exists (select 1 from profiles where id = auth.uid() and role = 'parent'));
create policy "parents edit their own children" on public.students for update to authenticated
  using (parent_id = auth.uid()) with check (parent_id = auth.uid());
create policy "parents or admins remove children" on public.students for delete to authenticated
  using (parent_id = auth.uid() or public.is_admin());

-- ---------- tutor_profiles (public "Meet the Tutors" cards) ----------
grant select on public.tutor_profiles to anon, authenticated;
grant update (public_name, bio, fun_fact, subjects, grade_min, grade_max, grades, formats, languages, photo_url, published, updated_at)
  on public.tutor_profiles to authenticated;
create policy "anyone sees published, approved tutors" on public.tutor_profiles for select to anon, authenticated
  using ((published and public.is_approved_tutor_id(tutor_id)) or tutor_id = auth.uid() or public.is_admin());
create policy "tutors edit own card" on public.tutor_profiles for update to authenticated
  using (tutor_id = auth.uid() or public.is_admin()) with check (tutor_id = auth.uid() or public.is_admin());

-- ---------- tutor_students ----------
grant select, insert, delete on public.tutor_students to authenticated;
create policy "see tutor links" on public.tutor_students for select to authenticated
  using (tutor_id = auth.uid() or public.is_admin() or public.is_student_or_parent(student_id));
create policy "admins link tutors and students" on public.tutor_students for insert to authenticated
  with check (public.is_admin());
create policy "admins unlink tutors and students" on public.tutor_students for delete to authenticated
  using (public.is_admin());

-- ---------- availability ----------
grant select, insert, update, delete on public.availability_rules, public.availability_blocks to authenticated;
create policy "tutors manage own hours" on public.availability_rules for all to authenticated
  using (tutor_id = auth.uid() or public.is_admin())
  with check ((tutor_id = auth.uid() and public.is_approved_tutor()) or public.is_admin());
create policy "tutors manage own days off" on public.availability_blocks for all to authenticated
  using (tutor_id = auth.uid() or public.is_admin())
  with check ((tutor_id = auth.uid() and public.is_approved_tutor()) or public.is_admin());

-- ---------- bookings ----------
-- Created/cancelled only through the book_session / cancel_booking functions
-- (next migration), which check every rule. Tutors may set the meeting link.
grant select on public.bookings to authenticated;
grant update (meeting_link) on public.bookings to authenticated;
create policy "see your own bookings" on public.bookings for select to authenticated
  using (parent_id = auth.uid()
      or (tutor_id = auth.uid() and public.is_approved_tutor())
      or student_id = public.my_student_id()
      or public.is_admin());
create policy "tutors add meeting links" on public.bookings for update to authenticated
  using (tutor_id = auth.uid() and public.is_approved_tutor())
  with check (tutor_id = auth.uid());

-- ---------- session notes ----------
grant select, insert, update on public.session_notes to authenticated;
create policy "see notes for students you may see" on public.session_notes for select to authenticated
  using (tutor_id = auth.uid() or public.is_student_or_parent(student_id) or public.is_admin());
create policy "tutors write notes for their own sessions" on public.session_notes for insert to authenticated
  with check (tutor_id = auth.uid() and public.is_approved_tutor() and exists (
    select 1 from bookings b where b.id = booking_id and b.tutor_id = auth.uid() and b.student_id = session_notes.student_id));
create policy "tutors edit their own notes" on public.session_notes for update to authenticated
  using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

-- ---------- assignments ----------
grant select, insert, update, delete on public.assignments to authenticated;
create policy "see assignments" on public.assignments for select to authenticated
  using (tutor_id = auth.uid() or public.is_admin()
    or exists (select 1 from assignment_students a where a.assignment_id = assignments.id and public.is_student_or_parent(a.student_id)));
create policy "approved tutors create assignments" on public.assignments for insert to authenticated
  with check (tutor_id = auth.uid() and public.is_approved_tutor());
create policy "tutors edit own assignments" on public.assignments for update to authenticated
  using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());
create policy "tutors delete own assignments" on public.assignments for delete to authenticated
  using (tutor_id = auth.uid() or public.is_admin());

grant select, insert, delete on public.assignment_students to authenticated;
create policy "see who an assignment is for" on public.assignment_students for select to authenticated
  using (public.owns_assignment(assignment_id) or public.is_student_or_parent(student_id) or public.is_admin());
create policy "assign only to your own students" on public.assignment_students for insert to authenticated
  with check (public.owns_assignment(assignment_id) and public.tutor_has_student(student_id));
create policy "unassign your own" on public.assignment_students for delete to authenticated
  using (public.owns_assignment(assignment_id));

-- Submissions are written through submit_assignment / review_submission functions.
grant select on public.submissions to authenticated;
create policy "see submissions" on public.submissions for select to authenticated
  using (public.owns_assignment(assignment_id) or public.is_student_or_parent(student_id) or public.is_admin());

-- ---------- quizzes ----------
grant select, insert, update, delete on public.quizzes, public.quiz_questions, public.quiz_question_keys to authenticated;
create policy "see quizzes" on public.quizzes for select to authenticated
  using (tutor_id = auth.uid() or public.can_view_quiz(id));
create policy "tutors create quizzes" on public.quizzes for insert to authenticated
  with check (tutor_id = auth.uid() and public.is_approved_tutor());
create policy "tutors edit own quizzes" on public.quizzes for update to authenticated
  using (tutor_id = auth.uid() or (tutor_id is null and public.is_admin()))
  with check (tutor_id = auth.uid() or (tutor_id is null and public.is_admin()));
create policy "tutors delete own quizzes" on public.quizzes for delete to authenticated
  using (tutor_id = auth.uid() or public.is_admin());

create policy "see questions" on public.quiz_questions for select to authenticated using (public.can_view_quiz(quiz_id));
create policy "owners write questions" on public.quiz_questions for all to authenticated
  using (public.owns_quiz(quiz_id)) with check (public.owns_quiz(quiz_id));

-- Answer keys: only the quiz owner, any approved tutor for library quizzes (so they can copy them), or admins.
create policy "only tutors see answer keys" on public.quiz_question_keys for select to authenticated
  using (exists (select 1 from quiz_questions q join quizzes z on z.id = q.quiz_id
    where q.id = question_id and (public.owns_quiz(z.id) or public.is_admin() or (z.tutor_id is null and public.is_approved_tutor()))));
create policy "owners write answer keys" on public.quiz_question_keys for all to authenticated
  using (exists (select 1 from quiz_questions q where q.id = question_id and public.owns_quiz(q.quiz_id)))
  with check (exists (select 1 from quiz_questions q where q.id = question_id and public.owns_quiz(q.quiz_id)));

grant select, insert, delete on public.quiz_assignments to authenticated;
create policy "see quiz assignments" on public.quiz_assignments for select to authenticated
  using (public.owns_quiz(quiz_id) or public.is_student_or_parent(student_id) or public.is_admin());
create policy "assign quizzes only to your own students" on public.quiz_assignments for insert to authenticated
  with check (public.owns_quiz(quiz_id) and public.tutor_has_student(student_id));
create policy "unassign your own quizzes" on public.quiz_assignments for delete to authenticated
  using (public.owns_quiz(quiz_id));

-- Attempts: students save progress (responses + position). Scores are written by the server only.
grant select on public.quiz_attempts to authenticated;
grant update (responses, current_index) on public.quiz_attempts to authenticated;
create policy "see attempts" on public.quiz_attempts for select to authenticated
  using (public.is_student_or_parent(student_id) or public.owns_quiz(quiz_id) or public.is_admin());
create policy "students save progress" on public.quiz_attempts for update to authenticated
  using (public.is_student_or_parent(student_id) and status = 'in_progress')
  with check (public.is_student_or_parent(student_id) and status = 'in_progress');

-- ---------- site content: everyone reads published items, admins edit ----------
grant select on public.announcements, public.faqs, public.resources, public.testimonials, public.site_settings to anon, authenticated;
grant insert, update, delete on public.announcements, public.faqs, public.resources, public.testimonials, public.site_settings to authenticated;
create policy "public reads active banner" on public.announcements for select to anon, authenticated using (active or public.is_admin());
create policy "public reads faqs" on public.faqs for select to anon, authenticated using (published or public.is_admin());
create policy "public reads resources" on public.resources for select to anon, authenticated using (published or public.is_admin());
create policy "public reads testimonials" on public.testimonials for select to anon, authenticated using (published or public.is_admin());
create policy "public reads settings" on public.site_settings for select to anon, authenticated using (true);
create policy "admins edit banner" on public.announcements for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins edit faqs" on public.faqs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins edit resources" on public.resources for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins edit testimonials" on public.testimonials for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins edit settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- form inboxes (written by the server; read by admins / tutors) ----------
grant select, update, delete on public.tutor_applications, public.contact_messages, public.help_requests to authenticated;
create policy "admins read applications" on public.tutor_applications for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read messages" on public.contact_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "tutors and admins see help requests" on public.help_requests for select to authenticated
  using (public.is_admin() or public.is_approved_tutor());
create policy "tutors and admins update help requests" on public.help_requests for update to authenticated
  using (public.is_admin() or public.is_approved_tutor()) with check (public.is_admin() or public.is_approved_tutor());
create policy "admins delete help requests" on public.help_requests for delete to authenticated using (public.is_admin());

-- rate_limits: no policies at all = only the server (service role) can use it.
