-- Private bucket for creatives the team has permission to store for internal research.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creatives',
  'creatives',
  false,
  26214400, -- 25 MB
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "members read creatives" on storage.objects
  for select to authenticated
  using (bucket_id = 'creatives' and (select public.is_team_member()));

create policy "members upload creatives" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'creatives' and (select public.is_team_member()));

create policy "owner or admin deletes creatives" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'creatives'
    and (select public.is_team_member())
    and (owner_id = (select auth.uid())::text or (select public.is_team_admin()))
  );
