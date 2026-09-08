-- Add an explicit processing pool so temporary backlog workers cannot claim
-- production jobs assigned to the storage VPS.

create type public.import_processing_pool as enum ('local', 'remote');

alter table public.import_jobs
  add column processing_pool public.import_processing_pool not null default 'local';

create index import_jobs_pool_claim_idx
  on public.import_jobs (processing_pool, status, created_at)
  where status in ('queued', 'scanning', 'processing');

drop function if exists public.claim_import_item(text, integer);

create or replace function public.claim_import_item(
  p_worker_id text,
  p_lease_seconds integer default 900,
  p_pool public.import_processing_pool default 'local'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.import_items%rowtype;
begin
  select i.* into v_item
  from public.import_items i
  join public.import_jobs j on j.id = i.job_id
  where j.status in ('queued', 'scanning', 'processing')
    and j.processing_pool = p_pool
    and not j.pause_requested
    and i.attempts < i.max_attempts
    and (i.status in ('discovered', 'queued') or (i.status = 'processing' and i.lease_until < now()))
  order by i.discovered_at
  for update of i skip locked limit 1;
  if not found then return null; end if;
  update public.import_items
    set status = 'processing', worker_id = p_worker_id, attempts = attempts + 1,
        lease_until = now() + make_interval(secs => greatest(60, least(p_lease_seconds, 3600))), heartbeat_at = now(), error_message = null
    where id = v_item.id
    returning * into v_item;
  update public.import_jobs set status = 'processing', started_at = coalesce(started_at, now()), worker_id = p_worker_id where id = v_item.job_id;
  return jsonb_build_object('id', v_item.id, 'job_id', v_item.job_id, 'source_name', v_item.source_name, 'source_size_bytes', v_item.source_size_bytes, 'source_mtime_ms', v_item.source_mtime_ms, 'attempts', v_item.attempts);
end;
$$;

revoke execute on function public.claim_import_item(text, integer, public.import_processing_pool) from public, anon, authenticated;
grant execute on function public.claim_import_item(text, integer, public.import_processing_pool) to service_role;
