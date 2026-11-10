-- =====================================================================
-- 3. FUNCTIONS: the only way to book, cancel, submit work, and start quizzes.
-- Each one checks WHO is calling and WHAT they are allowed to do, then
-- makes the change. Errors use short codes the website turns into
-- friendly, translated messages (e.g. 'slot_taken').
-- =====================================================================

-- ---------- Open times (used by the public calendar and booking) ----------
-- Builds 1-hour (or tutor-chosen) slots from each approved tutor's weekly
-- hours, in Detroit time, minus days off and already-booked sessions.
-- Returns NO student information.
create or replace function public.get_open_slots(
  p_from timestamptz,
  p_to timestamptz,
  p_subject text default null,
  p_mode text default null,
  p_grade text default null,
  p_tutor uuid default null
) returns table (tutor_id uuid, tutor_name text, starts_at timestamptz, ends_at timestamptz, subjects text[], modes text[])
language sql stable security definer set search_path = public as $$
  with settings as (
    select coalesce((select (value #>> '{}')::numeric from site_settings where key = 'min_booking_lead_hours'), 2) as lead_hours
  ),
  days as (
    select d::date as day
    from generate_series((p_from at time zone 'America/Detroit')::date,
                         (p_to at time zone 'America/Detroit')::date, interval '1 day') d
  ),
  windows as (
    select r.tutor_id, tp.public_name, r.subjects, r.modes, r.slot_minutes,
           (days.day + r.start_time) at time zone 'America/Detroit' as win_start,
           (days.day + r.end_time) at time zone 'America/Detroit' as win_end
    from availability_rules r
    join days on extract(dow from days.day) = r.weekday
    join profiles p on p.id = r.tutor_id and p.role = 'tutor' and p.approved
    join tutor_profiles tp on tp.tutor_id = r.tutor_id
    where not exists (select 1 from availability_blocks b where b.tutor_id = r.tutor_id and b.block_date = days.day)
      and (p_subject is null or p_subject = any (r.subjects))
      and (p_mode is null or p_mode = any (r.modes))
      and (p_tutor is null or r.tutor_id = p_tutor)
      and (p_grade is null or public.grade_num(p_grade) between tp.grade_min and tp.grade_max)
  ),
  slots as (
    select w.*, s as slot_start, s + make_interval(mins => w.slot_minutes) as slot_end
    from windows w,
         generate_series(w.win_start, w.win_end - make_interval(mins => w.slot_minutes), make_interval(mins => w.slot_minutes)) s
  )
  select s.tutor_id, s.public_name, s.slot_start, s.slot_end, s.subjects, s.modes
  from slots s, settings
  where s.slot_start >= greatest(p_from, now() + make_interval(secs => settings.lead_hours * 3600))
    and s.slot_start < p_to
    and not exists (
      select 1 from bookings bk
      where bk.tutor_id = s.tutor_id and bk.status <> 'cancelled'
        and tstzrange(bk.starts_at, bk.ends_at) && tstzrange(s.slot_start, s.slot_end))
  order by s.slot_start, s.public_name
$$;
grant execute on function public.get_open_slots(timestamptz, timestamptz, text, text, text, uuid) to anon, authenticated;

-- ---------- Book a session ----------
create or replace function public.book_session(
  p_student uuid,
  p_tutor uuid,          -- null = "any tutor"
  p_subject text,
  p_starts_at timestamptz,
  p_mode text,
  p_note text default null,
  p_is_intro boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_grade text;
  v_slot record;
  v_id uuid;
begin
  -- Only the child's parent can book for them.
  select grade into v_grade from students where id = p_student and parent_id = auth.uid();
  if v_grade is null then raise exception 'not_your_child' using errcode = 'P0001'; end if;
  if p_mode not in ('in_person', 'online') then raise exception 'bad_mode' using errcode = 'P0001'; end if;

  -- The time must be a real open slot (right tutor, subject, format, and grade).
  select * into v_slot
  from public.get_open_slots(p_starts_at, p_starts_at + interval '1 minute', p_subject, p_mode, v_grade, p_tutor) s
  where s.starts_at = p_starts_at
  order by random()   -- "any tutor": spread bookings across tutors
  limit 1;
  if v_slot is null then raise exception 'slot_taken' using errcode = 'P0001'; end if;

  begin
    insert into bookings (student_id, parent_id, tutor_id, subject, mode, starts_at, ends_at, note, is_intro)
    values (p_student, auth.uid(), v_slot.tutor_id, p_subject, p_mode, v_slot.starts_at, v_slot.ends_at,
            nullif(left(trim(coalesce(p_note, '')), 1000), ''), coalesce(p_is_intro, false))
    returning id into v_id;
  exception when exclusion_violation then
    -- Someone else booked it a moment ago, or the child already has a session then.
    raise exception 'slot_taken' using errcode = 'P0001';
  end;

  -- Booking links the tutor to the student so the tutor can see them.
  insert into tutor_students (tutor_id, student_id) values (v_slot.tutor_id, p_student)
  on conflict do nothing;
  return v_id;
end $$;
grant execute on function public.book_session(uuid, uuid, text, timestamptz, text, text, boolean) to authenticated;

-- ---------- Cancel ----------
-- Parents: up to N hours before (site_settings.cancel_window_hours).
-- Tutors: any time, but must give a reason (the parent is emailed).
create or replace function public.cancel_booking(p_booking uuid, p_reason text default null)
returns text   -- who cancelled: 'parent', 'tutor', or 'admin'
language plpgsql security definer set search_path = public as $$
declare
  b bookings;
  v_window numeric;
  v_who public.user_role;
begin
  select * into b from bookings where id = p_booking for update;
  if b.id is null or b.status <> 'booked' then raise exception 'not_found' using errcode = 'P0001'; end if;
  select coalesce((value #>> '{}')::numeric, 12) into v_window from site_settings where key = 'cancel_window_hours';

  if public.is_admin() then
    v_who := 'admin';
  elsif b.parent_id = auth.uid() then
    v_who := 'parent';
    if b.starts_at - now() < make_interval(secs => coalesce(v_window, 12) * 3600) then
      raise exception 'too_late' using errcode = 'P0001';
    end if;
  elsif b.tutor_id = auth.uid() and public.is_approved_tutor() then
    v_who := 'tutor';
    if char_length(trim(coalesce(p_reason, ''))) < 3 then
      raise exception 'reason_required' using errcode = 'P0001';
    end if;
  else
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  update bookings
     set status = 'cancelled', cancelled_by = v_who, cancelled_at = now(),
         cancel_reason = nullif(left(trim(coalesce(p_reason, '')), 500), '')
   where id = p_booking;
  return v_who::text;
end $$;
grant execute on function public.cancel_booking(uuid, text) to authenticated;

-- ---------- Reschedule (parent) = cancel + book a new time with the same tutor, in one step ----------
create or replace function public.reschedule_booking(p_booking uuid, p_new_start timestamptz)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  b bookings;
begin
  select * into b from bookings where id = p_booking and parent_id = auth.uid();
  if b.id is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform public.cancel_booking(p_booking, 'Rescheduled by family');
  -- If booking the new time fails, the whole thing is undone (old booking stays).
  return public.book_session(b.student_id, b.tutor_id, b.subject, p_new_start, b.mode, b.note, b.is_intro);
end $$;
grant execute on function public.reschedule_booking(uuid, timestamptz) to authenticated;

-- A session note marks the session as completed.
create or replace function public.mark_booking_completed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update bookings set status = 'completed' where id = new.booking_id and status = 'booked';
  return new;
end $$;
create trigger session_note_completes_booking
  after insert on public.session_notes
  for each row execute function public.mark_booking_completed();

-- ---------- Assignments: student (or parent) turns in work ----------
create or replace function public.submit_assignment(p_assignment uuid, p_student uuid, p_answer text, p_files text[] default '{}')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  f text;
begin
  if not public.is_student_or_parent(p_student) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if not exists (select 1 from assignment_students where assignment_id = p_assignment and student_id = p_student) then
    raise exception 'not_assigned' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_answer, ''))) = 0 and coalesce(array_length(p_files, 1), 0) = 0 then
    raise exception 'empty' using errcode = 'P0001';
  end if;
  -- Uploaded files must be in this student's own folder for this assignment.
  foreach f in array coalesce(p_files, '{}') loop
    if f not like p_student::text || '/' || p_assignment::text || '/%' then
      raise exception 'bad_file' using errcode = 'P0001';
    end if;
  end loop;
  if exists (select 1 from submissions where assignment_id = p_assignment and student_id = p_student and status = 'complete') then
    raise exception 'already_complete' using errcode = 'P0001';
  end if;

  insert into submissions (assignment_id, student_id, answer_text, file_paths, status, submitted_at)
  values (p_assignment, p_student, left(coalesce(p_answer, ''), 10000), coalesce(p_files, '{}'), 'submitted', now())
  on conflict (assignment_id, student_id) do update
    set answer_text = excluded.answer_text, file_paths = excluded.file_paths,
        status = 'submitted', submitted_at = now()
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.submit_assignment(uuid, uuid, text, text[]) to authenticated;

-- ---------- Assignments: tutor gives feedback ----------
create or replace function public.review_submission(
  p_submission uuid, p_feedback text, p_score int default null, p_sticker text default null, p_complete boolean default true
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_assignment uuid;
begin
  select assignment_id into v_assignment from submissions where id = p_submission;
  if v_assignment is null or not public.owns_assignment(v_assignment) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  update submissions
     set feedback = nullif(left(trim(coalesce(p_feedback, '')), 3000), ''),
         score = case when p_score between 0 and 100 then p_score else null end,
         sticker = nullif(left(coalesce(p_sticker, ''), 16), ''),
         status = case when p_complete then 'complete' else 'returned' end,
         reviewed_at = now()
   where id = p_submission;
end $$;
grant execute on function public.review_submission(uuid, text, int, text, boolean) to authenticated;

-- ---------- Quizzes: start (or resume) an attempt ----------
create or replace function public.start_quiz_attempt(p_quiz uuid, p_student uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_retries boolean;
begin
  if not public.is_student_or_parent(p_student) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if not exists (select 1 from quiz_assignments where quiz_id = p_quiz and student_id = p_student) then
    raise exception 'not_assigned' using errcode = 'P0001';
  end if;
  -- Resume an unfinished attempt if there is one.
  select id into v_id from quiz_attempts
   where quiz_id = p_quiz and student_id = p_student and status = 'in_progress'
   order by started_at desc limit 1;
  if v_id is not null then return v_id; end if;

  select allow_retries into v_retries from quizzes where id = p_quiz;
  if not v_retries and exists (select 1 from quiz_attempts where quiz_id = p_quiz and student_id = p_student and status = 'submitted') then
    raise exception 'no_retries' using errcode = 'P0001';
  end if;
  insert into quiz_attempts (quiz_id, student_id) values (p_quiz, p_student) returning id into v_id;
  return v_id;
end $$;
grant execute on function public.start_quiz_attempt(uuid, uuid) to authenticated;

-- ---------- Admin: change a user's role or approve a tutor ----------
create or replace function public.admin_set_user(p_user uuid, p_role public.user_role, p_approved boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'cannot_demote_self' using errcode = 'P0001';
  end if;
  update profiles set role = p_role, approved = p_approved where id = p_user;
  if p_role = 'tutor' then
    insert into tutor_profiles (tutor_id, public_name)
    select id, display_name from profiles where id = p_user
    on conflict do nothing;
  end if;
end $$;
grant execute on function public.admin_set_user(uuid, public.user_role, boolean) to authenticated;

-- ---------- Spam protection (server only) ----------
create or replace function public.check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  r rate_limits;
begin
  insert into rate_limits (key, window_start, count) values (p_key, now(), 1)
  on conflict (key) do update
    set count = case when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rate_limits.count + 1 end,
        window_start = case when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now() else rate_limits.window_start end
  returning * into r;
  -- Tidy up old rows now and then.
  if random() < 0.01 then delete from rate_limits where window_start < now() - interval '1 day'; end if;
  return r.count <= p_limit;
end $$;
revoke execute on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
