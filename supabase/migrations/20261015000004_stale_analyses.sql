-- Treat analyses stuck in 'pending' for over three minutes as failed in the
-- library view (e.g. the server restarted mid-run). Matches STALE_PENDING_MS
-- in lib/data/analyses.ts.

create or replace view public.ad_library
with (security_invoker = true)
as
select
  a.*,
  case
    when latest.status is null then 'none'
    when latest.status = 'pending' and latest.created_at < now() - interval '3 minutes' then 'failed'
    else latest.status::text
  end as analysis_status,
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
