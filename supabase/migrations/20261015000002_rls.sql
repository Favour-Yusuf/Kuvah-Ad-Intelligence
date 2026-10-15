-- Row Level Security. Every table is closed by default; only Kuvah team
-- members (rows in team_members) can read or write. The anon role gets nothing.

alter table public.team_members enable row level security;
alter table public.ads enable row level security;
alter table public.ad_analyses enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.tags enable row level security;
alter table public.ad_tags enable row level security;
alter table public.ad_notes enable row level security;

revoke all on all tables in schema public from anon;

-- team_members: readable by members, managed by admins.
create policy "members read team" on public.team_members
  for select to authenticated using ((select public.is_team_member()));
create policy "admins add members" on public.team_members
  for insert to authenticated with check ((select public.is_team_admin()));
create policy "admins update members" on public.team_members
  for update to authenticated using ((select public.is_team_admin())) with check ((select public.is_team_admin()));
create policy "admins remove members" on public.team_members
  for delete to authenticated using ((select public.is_team_admin()));

-- ads
create policy "members read ads" on public.ads
  for select to authenticated using ((select public.is_team_member()));
create policy "members create ads" on public.ads
  for insert to authenticated
  with check ((select public.is_team_member()) and created_by = (select auth.uid()));
create policy "members edit ads" on public.ads
  for update to authenticated
  using ((select public.is_team_member())) with check ((select public.is_team_member()));
create policy "creator or admin deletes ads" on public.ads
  for delete to authenticated
  using ((select public.is_team_member()) and (created_by = (select auth.uid()) or (select public.is_team_admin())));

-- ad_analyses: members create pending runs; only the server (secret key) completes them.
create policy "members read analyses" on public.ad_analyses
  for select to authenticated using ((select public.is_team_member()));
create policy "members start analyses" on public.ad_analyses
  for insert to authenticated
  with check (
    (select public.is_team_member())
    and created_by = (select auth.uid())
    and status = 'pending'
    and result is null
  );

-- collections
create policy "members read collections" on public.collections
  for select to authenticated using ((select public.is_team_member()));
create policy "members create collections" on public.collections
  for insert to authenticated
  with check ((select public.is_team_member()) and created_by = (select auth.uid()));
create policy "members edit collections" on public.collections
  for update to authenticated
  using ((select public.is_team_member())) with check ((select public.is_team_member()));
create policy "creator or admin deletes collections" on public.collections
  for delete to authenticated
  using ((select public.is_team_member()) and (created_by = (select auth.uid()) or (select public.is_team_admin())));

-- collection_items
create policy "members read collection items" on public.collection_items
  for select to authenticated using ((select public.is_team_member()));
create policy "members add collection items" on public.collection_items
  for insert to authenticated
  with check ((select public.is_team_member()) and added_by = (select auth.uid()));
create policy "members edit collection item notes" on public.collection_items
  for update to authenticated
  using ((select public.is_team_member())) with check ((select public.is_team_member()));
create policy "adder or admin removes collection items" on public.collection_items
  for delete to authenticated
  using ((select public.is_team_member()) and (added_by = (select auth.uid()) or (select public.is_team_admin())));

-- tags: shared vocabulary. Admins prune unused tags.
create policy "members read tags" on public.tags
  for select to authenticated using ((select public.is_team_member()));
create policy "members create tags" on public.tags
  for insert to authenticated with check ((select public.is_team_member()));
create policy "admins delete tags" on public.tags
  for delete to authenticated using ((select public.is_team_admin()));

-- ad_tags: tagging is an editable attribute of an ad, like its other fields.
create policy "members read ad tags" on public.ad_tags
  for select to authenticated using ((select public.is_team_member()));
create policy "members tag ads" on public.ad_tags
  for insert to authenticated with check ((select public.is_team_member()));
create policy "members untag ads" on public.ad_tags
  for delete to authenticated using ((select public.is_team_member()));

-- ad_notes: authors edit their own notes.
create policy "members read notes" on public.ad_notes
  for select to authenticated using ((select public.is_team_member()));
create policy "members write notes" on public.ad_notes
  for insert to authenticated
  with check ((select public.is_team_member()) and author = (select auth.uid()));
create policy "authors edit notes" on public.ad_notes
  for update to authenticated
  using ((select public.is_team_member()) and author = (select auth.uid()))
  with check (author = (select auth.uid()));
create policy "author or admin deletes notes" on public.ad_notes
  for delete to authenticated
  using ((select public.is_team_member()) and (author = (select auth.uid()) or (select public.is_team_admin())));
