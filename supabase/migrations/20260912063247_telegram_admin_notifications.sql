create table public.telegram_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('payment_submitted', 'support_ticket_created')),
  resource_id uuid not null,
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 8),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text check (locked_by is null or char_length(locked_by) <= 100),
  sent_at timestamptz,
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 80),
  created_at timestamptz not null default now(),
  unique (kind, resource_id)
);

create index telegram_outbox_claim_idx
  on public.telegram_outbox(status, next_attempt_at, created_at);

alter table public.telegram_outbox enable row level security;
revoke all on table public.telegram_outbox from anon, authenticated;

create or replace function public.submit_payment_request(p_user_id uuid, p_proof_encrypted text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if p_user_id is null or p_proof_encrypted is null or char_length(p_proof_encrypted) < 1 then
    raise exception 'invalid_payment';
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'user_not_found';
  end if;
  if exists (select 1 from public.users where id = p_user_id and membership_status = 'premium') then
    raise exception 'already_premium';
  end if;
  if exists (select 1 from public.payment_requests where user_id = p_user_id and status = 'pending') then
    raise exception 'pending_exists';
  end if;

  insert into public.payment_requests (user_id, proof_encrypted)
  values (p_user_id, p_proof_encrypted)
  returning id into new_id;

  update public.users
  set membership_status = 'pending', updated_at = now()
  where id = p_user_id;

  insert into public.telegram_outbox(kind, resource_id)
  values ('payment_submitted', new_id)
  on conflict (kind, resource_id) do nothing;

  return new_id;
end;
$$;

create or replace function public.create_support_ticket(p_user_id uuid, p_subject text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_id uuid;
begin
  if not exists (select 1 from public.users where id = p_user_id) then raise exception 'user_not_found'; end if;
  if p_subject is null or char_length(trim(p_subject)) not between 1 and 160 then raise exception 'invalid_subject'; end if;
  if p_body is null or char_length(trim(p_body)) not between 1 and 10000 then raise exception 'invalid_body'; end if;
  insert into public.support_tickets(user_id, subject) values (p_user_id, trim(p_subject)) returning id into ticket_id;
  insert into public.support_messages(ticket_id, author_id, body) values (ticket_id, p_user_id, trim(p_body));

  insert into public.telegram_outbox(kind, resource_id)
  values ('support_ticket_created', ticket_id)
  on conflict (kind, resource_id) do nothing;

  return ticket_id;
end;
$$;

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
  set status = case when attempts >= 8 then 'failed' else 'pending' end,
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

create or replace function public.mark_telegram_sent(p_outbox_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.telegram_outbox
  set status = 'sent', sent_at = now(), locked_at = null, locked_by = null
  where id = p_outbox_id;
$$;

create or replace function public.mark_telegram_failed(p_outbox_id uuid, p_error_code text, p_retry_after_seconds integer default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.telegram_outbox
  set status = case when attempts >= 8 then 'failed' else 'pending' end,
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

revoke all on function public.submit_payment_request(uuid, text) from public;
revoke all on function public.create_support_ticket(uuid, text, text) from public;
revoke all on function public.claim_next_telegram(text) from public;
revoke all on function public.mark_telegram_sent(uuid) from public;
revoke all on function public.mark_telegram_failed(uuid, text, integer) from public;

grant execute on function public.submit_payment_request(uuid, text) to service_role;
grant execute on function public.create_support_ticket(uuid, text, text) to service_role;
grant execute on function public.claim_next_telegram(text) to service_role;
grant execute on function public.mark_telegram_sent(uuid) to service_role;
grant execute on function public.mark_telegram_failed(uuid, text, integer) to service_role;
