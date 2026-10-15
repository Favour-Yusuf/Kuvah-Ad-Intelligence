-- Kuvah Ad Intelligence: core schema.

create extension if not exists citext with schema extensions;

-- Enums ---------------------------------------------------------------------

create type public.team_role as enum ('admin', 'member');
create type public.ad_platform as enum ('facebook', 'instagram', 'tiktok', 'google');
create type public.ad_format as enum ('image', 'video', 'carousel', 'text', 'other');
create type public.analysis_status as enum ('pending', 'complete', 'failed');

-- Helpers -------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Stamps the acting user on insert and keeps it immutable afterwards.
-- auth.uid() is null for the secret-key client, which may set the column itself.
create function public.stamp_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  col text := tg_argv[0];
  actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if actor is not null then
      new := jsonb_populate_record(new, jsonb_build_object(col, actor));
    end if;
  elsif tg_op = 'UPDATE' then
    new := jsonb_populate_record(new, jsonb_build_object(col, to_jsonb(old) -> col));
  end if;
  return new;
end;
$$;

-- Team ----------------------------------------------------------------------

create table public.team_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.team_role not null default 'member',
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

create function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.team_members where user_id = (select auth.uid()));
$$;

create function public.is_team_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_team_member() from public, anon;
revoke execute on function public.is_team_admin() from public, anon;
grant execute on function public.is_team_member() to authenticated;
grant execute on function public.is_team_admin() to authenticated;

-- Ads -----------------------------------------------------------------------

create table public.ads (
  id uuid primary key default gen_random_uuid(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  source_type text not null default 'manual' check (source_type ~ '^[a-z][a-z0-9_]{1,39}$'),
  source_url text not null check (source_url ~* '^https://' and char_length(source_url) <= 2048),
  brand text not null check (char_length(btrim(brand)) between 1 and 120),
  platform public.ad_platform not null,
  target_country char(2) not null check (target_country ~ '^[A-Z]{2}$'),
  industry text check (char_length(industry) <= 80),
  format public.ad_format not null,
  headline text check (char_length(headline) <= 300),
  ad_copy text check (char_length(ad_copy) <= 5000),
  creative_description text check (char_length(creative_description) <= 3000),
  cta text check (char_length(cta) <= 80),
  -- "Not in the future" is enforced by app validation; CHECK constraints must not depend on now().
  observed_at date not null check (observed_at >= date '2000-01-01'),
  research_notes text check (char_length(research_notes) <= 5000),
  marketing_angle text check (char_length(marketing_angle) <= 120),
  creative_path text check (char_length(creative_path) <= 512),
  search tsvector generated always as (
    to_tsvector(
      'simple'::regconfig,
      coalesce(brand, '') || ' ' || coalesce(headline, '') || ' ' || coalesce(ad_copy, '') || ' ' ||
      coalesce(creative_description, '') || ' ' || coalesce(research_notes, '') || ' ' || coalesce(cta, '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ads_search_idx on public.ads using gin (search);
create index ads_platform_idx on public.ads (platform);
create index ads_country_idx on public.ads (target_country);
create index ads_format_idx on public.ads (format);
create index ads_industry_idx on public.ads (industry);
create index ads_angle_idx on public.ads (marketing_angle);
create index ads_observed_idx on public.ads (observed_at desc);
create index ads_created_idx on public.ads (created_at desc);

create trigger ads_updated_at before update on public.ads
  for each row execute function public.set_updated_at();
create trigger ads_actor before insert or update on public.ads
  for each row execute function public.stamp_actor('created_by');

-- Analyses ------------------------------------------------------------------

create table public.ad_analyses (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.ads (id) on delete cascade,
  status public.analysis_status not null default 'pending',
  provider text not null check (char_length(provider) <= 40),
  model text not null check (char_length(model) <= 80),
  input_hash text not null check (char_length(input_hash) = 64),
  result jsonb,
  warnings text[] not null default '{}',
  error text check (char_length(error) <= 1000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index ad_analyses_ad_idx on public.ad_analyses (ad_id, created_at desc);
create index ad_analyses_actor_idx on public.ad_analyses (created_by, created_at desc);
create index ad_analyses_status_idx on public.ad_analyses (status, created_at desc);

create trigger ad_analyses_actor before insert or update on public.ad_analyses
  for each row execute function public.stamp_actor('created_by');

-- Collections ---------------------------------------------------------------

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (char_length(description) <= 1000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger collections_updated_at before update on public.collections
  for each row execute function public.set_updated_at();
create trigger collections_actor before insert or update on public.collections
  for each row execute function public.stamp_actor('created_by');

create table public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  ad_id uuid not null references public.ads (id) on delete cascade,
  added_by uuid default auth.uid() references auth.users (id) on delete set null,
  added_at timestamptz not null default now(),
  note text check (char_length(note) <= 2000),
  primary key (collection_id, ad_id)
);

create index collection_items_ad_idx on public.collection_items (ad_id);
create index collection_items_added_idx on public.collection_items (added_at desc);

create trigger collection_items_actor before insert or update on public.collection_items
  for each row execute function public.stamp_actor('added_by');

-- Tags ----------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name extensions.citext not null unique check (char_length(btrim(name::text)) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.ad_tags (
  ad_id uuid not null references public.ads (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (ad_id, tag_id)
);

create index ad_tags_tag_idx on public.ad_tags (tag_id);

-- Notes ---------------------------------------------------------------------

create table public.ad_notes (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.ads (id) on delete cascade,
  author uuid default auth.uid() references auth.users (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index ad_notes_ad_idx on public.ad_notes (ad_id, created_at desc);

create trigger ad_notes_actor before insert or update on public.ad_notes
  for each row execute function public.stamp_actor('author');

-- Library view --------------------------------------------------------------
-- security_invoker makes the view run with the caller's RLS.

create view public.ad_library
with (security_invoker = true)
as
select
  a.*,
  coalesce(latest.status::text, 'none') as analysis_status,
  latest.id as latest_analysis_id,
  latest.created_at as latest_analysis_at
from public.ads a
left join lateral (
  select an.id, an.status, an.created_at
  from public.ad_analyses an
  where an.ad_id = a.id
  order by an.created_at desc
  limit 1
) latest on true;
