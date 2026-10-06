-- Keep a GA4 web client identifier only while a gift-card payment is pending,
-- so server-side approval can be attributed to its original browser session.
-- The table is private and this value is never returned through the API.
alter table public.payment_requests
  add column if not exists ga_client_id text;

comment on column public.payment_requests.ga_client_id is
  'Private GA4 client identifier used only for approved-payment attribution; never expose through user-facing APIs.';

create or replace function public.submit_payment_request(
  p_user_id uuid,
  p_proof_encrypted text,
  p_ga_client_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  analytics_client_id text := case
    when p_ga_client_id ~ '^[0-9]{1,20}\.[0-9]{1,20}$' then p_ga_client_id
    else null
  end;
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

  insert into public.payment_requests (user_id, proof_encrypted, ga_client_id)
  values (p_user_id, p_proof_encrypted, analytics_client_id)
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

-- Preserve compatibility with any older server release still calling the
-- original two-argument RPC. It cannot attach analytics attribution.
create or replace function public.submit_payment_request(p_user_id uuid, p_proof_encrypted text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.submit_payment_request(p_user_id, p_proof_encrypted, null);
$$;

revoke all on function public.submit_payment_request(uuid, text, text) from public, anon, authenticated;
revoke all on function public.submit_payment_request(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_payment_request(uuid, text, text) to service_role;
grant execute on function public.submit_payment_request(uuid, text) to service_role;
