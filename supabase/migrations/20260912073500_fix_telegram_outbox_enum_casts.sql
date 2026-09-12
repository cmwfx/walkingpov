create or replace function public.claim_next_telegram(p_worker_id text)
returns table (outbox_id uuid, kind text, resource_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id uuid;
begin
  update public.telegram_outbox
  set status = case
        when attempts >= 8 then 'failed'::public.outbox_status
        else 'pending'::public.outbox_status
      end,
      locked_at = null,
      locked_by = null,
      last_error_code = 'worker_timeout'
  where status = 'processing' and locked_at < now() - interval '10 minutes';

  select id into row_id from public.telegram_outbox
  where status = 'pending' and next_attempt_at <= now()
  order by created_at
  for update skip locked limit 1;
  if row_id is null then return; end if;

  update public.telegram_outbox
  set status = 'processing', locked_at = now(), locked_by = left(coalesce(p_worker_id, ''), 100), attempts = attempts + 1
  where id = row_id;

  return query
    select id, telegram_outbox.kind, telegram_outbox.resource_id
    from public.telegram_outbox
    where id = row_id;
end;
$$;

create or replace function public.mark_telegram_failed(p_outbox_id uuid, p_error_code text, p_retry_after_seconds integer default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.telegram_outbox
  set status = case
        when attempts >= 8 then 'failed'::public.outbox_status
        else 'pending'::public.outbox_status
      end,
      next_attempt_at = now() + case
        when p_retry_after_seconds between 1 and 21600 then make_interval(secs => p_retry_after_seconds)
        else least((2 ^ greatest(attempts - 1, 0)) * interval '1 minute', interval '6 hours')
      end,
      locked_at = null,
      locked_by = null,
      last_error_code = left(coalesce(nullif(p_error_code, ''), 'delivery_failed'), 80)
  where id = p_outbox_id;
end;
$$;
