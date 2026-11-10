-- =====================================================================
-- 4. FILE STORAGE
-- Assignment files and photos of student work are in PRIVATE buckets.
-- Nobody gets a public link; the site makes short-lived signed links only
-- for people the policies below allow.
--
-- Folder layout:
--   assignment-files/{assignment_id}/{file}
--   submission-files/{student_id}/{assignment_id}/{file}
--   tutor-photos/{tutor_id}/{file}       (public: tutors' own profile photos)
--   quiz-images/{tutor_id}/{file}        (public: pictures inside quiz questions, no student info)
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('assignment-files', 'assignment-files', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp','image/heic']),
  ('submission-files', 'submission-files', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp','image/heic']),
  ('tutor-photos', 'tutor-photos', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('quiz-images', 'quiz-images', true, 2097152, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do nothing;

-- Turns text into a uuid, or null if it isn't one (so odd paths can't cause errors).
create or replace function public.try_uuid(t text) returns uuid
language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end $$;
grant execute on function public.try_uuid(text) to authenticated;

-- assignment-files
create policy "tutors upload files to their own assignments" on storage.objects for insert to authenticated
  with check (bucket_id = 'assignment-files'
    and public.owns_assignment(public.try_uuid((storage.foldername(name))[1])));
create policy "tutors delete their assignment files" on storage.objects for delete to authenticated
  using (bucket_id = 'assignment-files'
    and public.owns_assignment(public.try_uuid((storage.foldername(name))[1])));
create policy "assigned students, parents, owner tutor read assignment files" on storage.objects for select to authenticated
  using (bucket_id = 'assignment-files' and (
    public.owns_assignment(public.try_uuid((storage.foldername(name))[1]))
    or public.is_admin()
    or exists (select 1 from public.assignment_students a
               where a.assignment_id = public.try_uuid((storage.foldername(name))[1])
                 and public.is_student_or_parent(a.student_id))));

-- submission-files
create policy "students or parents upload their own work" on storage.objects for insert to authenticated
  with check (bucket_id = 'submission-files'
    and public.is_student_or_parent(public.try_uuid((storage.foldername(name))[1]))
    and exists (select 1 from public.assignment_students a
                where a.student_id = public.try_uuid((storage.foldername(name))[1])
                  and a.assignment_id = public.try_uuid((storage.foldername(name))[2])));
create policy "students, parents, owner tutor read submitted work" on storage.objects for select to authenticated
  using (bucket_id = 'submission-files' and (
    public.is_student_or_parent(public.try_uuid((storage.foldername(name))[1]))
    or public.owns_assignment(public.try_uuid((storage.foldername(name))[2]))
    or public.is_admin()));

-- tutor-photos and quiz-images: anyone can view (public buckets); tutors write only their own folder.
create policy "tutors upload own photos and quiz images" on storage.objects for insert to authenticated
  with check (bucket_id in ('tutor-photos', 'quiz-images')
    and (storage.foldername(name))[1] = auth.uid()::text and public.is_approved_tutor());
create policy "tutors replace own photos and quiz images" on storage.objects for update to authenticated
  using (bucket_id in ('tutor-photos', 'quiz-images') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "tutors delete own photos and quiz images" on storage.objects for delete to authenticated
  using (bucket_id in ('tutor-photos', 'quiz-images') and (storage.foldername(name))[1] = auth.uid()::text);
