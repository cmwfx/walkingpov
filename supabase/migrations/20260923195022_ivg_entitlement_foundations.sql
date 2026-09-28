-- InstantVidGrab/WalkingPOV integration foundations.
-- Additive only: legacy membership remains the compatibility surface, while
-- independent grant rows become the source of truth for future recomputation.

create type public.ivg_product as enum ('walkingpov', 'instantvidgrab');
create type public.ivg_grant_source as enum (
  'legacy_membership',
  'legacy_payment_request',
  'whop_payment',
  'complimentary',
  'manual'
);
create type public.ivg_grant_state as enum ('active', 'suspended', 'revoked');
create type public.ivg_link_state as enum ('pending', 'verified', 'revoked');
create type public.ivg_event_state as enum ('received', 'processing', 'processed', 'failed');
create type public.ivg_job_state as enum ('queued', 'leased', 'completed', 'dead_letter');

create table public.ivg_access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product public.ivg_product not null,
  source_type public.ivg_grant_source not null,
  source_id varchar(160) not null check (char_length(source_id) between 1 and 160),
  state public.ivg_grant_state not null default 'active',
  version bigint not null default 1 check (version > 0),
  reason_code varchar(80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ivg_access_grants_source_unique
    unique (user_id, product, source_type, source_id)
);

create index ivg_access_grants_effective_idx
  on public.ivg_access_grants(user_id, product, state);

create table public.ivg_identity_links (
  walkingpov_user_id uuid primary key references public.users(id) on delete cascade,
  instantvidgrab_user_id varchar(36) not null
    check (char_length(instantvidgrab_user_id) between 1 and 36),
  state public.ivg_link_state not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ivg_identity_links_instantvidgrab_unique unique (instantvidgrab_user_id)
);

create table public.ivg_auth_codes (
  code_hash bytea primary key check (octet_length(code_hash) = 32),
  walkingpov_user_id uuid not null references public.users(id) on delete cascade,
  instantvidgrab_user_id varchar(36)
    check (instantvidgrab_user_id is null or char_length(instantvidgrab_user_id) between 1 and 36),
  state_hash bytea not null check (octet_length(state_hash) = 32),
  verifier_challenge varchar(128) not null check (char_length(verifier_challenge) between 43 and 128),
  intent varchar(24) not null check (intent in ('checkout', 'download', 'connect')),
  destination varchar(24) not null check (destination in ('checkout', 'download', 'dashboard')),
  selected_video_id uuid,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index ivg_auth_codes_expiry_idx on public.ivg_auth_codes(expires_at);

create table public.ivg_integration_inbox (
  id uuid primary key default gen_random_uuid(),
  source varchar(24) not null check (source in ('whop', 'instantvidgrab')),
  event_id varchar(160) not null check (char_length(event_id) between 1 and 160),
  event_type varchar(80) not null check (char_length(event_type) between 1 and 80),
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  -- Store only a sanitized event envelope here; never persist card data or raw URLs.
  payload jsonb not null default '{}'::jsonb,
  state public.ivg_event_state not null default 'received',
  attempts smallint not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  failure_code varchar(80) check (failure_code is null or char_length(failure_code) <= 80),
  received_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint ivg_integration_inbox_event_unique unique (source, event_id)
);

create index ivg_integration_inbox_work_idx
  on public.ivg_integration_inbox(state, next_attempt_at, received_at);

create table public.ivg_integration_outbox (
  id uuid primary key default gen_random_uuid(),
  idempotency_key varchar(191) not null unique
    check (char_length(idempotency_key) between 1 and 191),
  kind varchar(80) not null check (char_length(kind) between 1 and 80),
  aggregate_id varchar(160) not null check (char_length(aggregate_id) between 1 and 160),
  payload jsonb not null default '{}'::jsonb,
  state public.ivg_job_state not null default 'queued',
  attempts smallint not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_owner varchar(80),
  lease_token uuid,
  lease_expires_at timestamptz,
  failure_code varchar(80) check (failure_code is null or char_length(failure_code) <= 80),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index ivg_integration_outbox_claim_idx
  on public.ivg_integration_outbox(state, next_attempt_at, created_at);
create index ivg_integration_outbox_lease_idx
  on public.ivg_integration_outbox(lease_expires_at, created_at)
  where state = 'leased';

create table public.ivg_internal_nonces (
  id uuid primary key default gen_random_uuid(),
  key_id varchar(64) not null check (char_length(key_id) between 1 and 64),
  nonce varchar(96) not null check (char_length(nonce) between 24 and 96),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint ivg_internal_nonces_unique unique (key_id, nonce)
);

create index ivg_internal_nonces_expiry_idx on public.ivg_internal_nonces(expires_at);

-- Backfill only users already effectively premium. ON CONFLICT makes the data
-- step safe to repeat and, importantly, it does not rewrite membership_status.
insert into public.ivg_access_grants (
  user_id,
  product,
  source_type,
  source_id,
  state,
  version,
  reason_code
)
select
  users.id,
  'walkingpov'::public.ivg_product,
  'legacy_membership'::public.ivg_grant_source,
  users.id::text,
  'active'::public.ivg_grant_state,
  1,
  'legacy_premium_backfill'
from public.users as users
where users.membership_status = 'premium'::public.membership_status
on conflict (user_id, product, source_type, source_id) do nothing;

create or replace function public.recompute_ivg_membership(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  next_status public.membership_status;
begin
  if p_user_id is null then
    return;
  end if;

  -- Serialize membership recomputation for this account.
  perform 1
  from public.users as users
  where users.id = p_user_id
  for update;

  if not found then
    return;
  end if;

  if exists (
    select 1
    from public.ivg_access_grants as grants
    where grants.user_id = p_user_id
      and grants.product = 'walkingpov'::public.ivg_product
      and grants.state = 'active'::public.ivg_grant_state
  ) then
    next_status := 'premium'::public.membership_status;
  elsif exists (
    select 1
    from public.payment_requests as requests
    where requests.user_id = p_user_id
      and requests.status = 'pending'::public.payment_status
  ) then
    next_status := 'pending'::public.membership_status;
  elsif exists (
    select 1
    from public.payment_requests as requests
    where requests.user_id = p_user_id
      and requests.status = 'denied'::public.payment_status
  ) then
    next_status := 'denied'::public.membership_status;
  else
    next_status := 'free'::public.membership_status;
  end if;

  update public.users as users
  set membership_status = next_status,
      updated_at = pg_catalog.now()
  where users.id = p_user_id
    and users.membership_status is distinct from next_status;
end;
$function$;

create or replace function public.ivg_guard_membership_downgrade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.membership_status is distinct from old.membership_status
     and new.membership_status <> 'premium'::public.membership_status
     and exists (
       select 1
       from public.ivg_access_grants as grants
       where grants.user_id = new.id
         and grants.product = 'walkingpov'::public.ivg_product
         and grants.state = 'active'::public.ivg_grant_state
     ) then
    new.membership_status := 'premium'::public.membership_status;
    new.updated_at := pg_catalog.now();
  end if;
  return new;
end;
$function$;

create trigger ivg_guard_membership_downgrade
before update of membership_status on public.users
for each row
when (old.membership_status is distinct from new.membership_status)
execute function public.ivg_guard_membership_downgrade();

create or replace function public.ivg_recompute_after_grant_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_ivg_membership(old.user_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    perform public.recompute_ivg_membership(old.user_id);
  end if;
  perform public.recompute_ivg_membership(new.user_id);
  return new;
end;
$function$;

create trigger ivg_recompute_after_grant_change
after insert or update or delete on public.ivg_access_grants
for each row
execute function public.ivg_recompute_after_grant_change();

create or replace function public.ivg_recompute_after_payment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    update public.ivg_access_grants as grants
    set state = 'revoked'::public.ivg_grant_state,
        version = grants.version + 1,
        reason_code = 'legacy_payment_request_deleted',
        updated_at = pg_catalog.now()
    where grants.user_id = old.user_id
      and grants.product = 'walkingpov'::public.ivg_product
      and grants.source_type = 'legacy_payment_request'::public.ivg_grant_source
      and grants.source_id = old.id::text
      and grants.state <> 'revoked'::public.ivg_grant_state;
    perform public.recompute_ivg_membership(old.user_id);
    return old;
  end if;

  -- Each approval is its own grant. Reversing/deleting that same request
  -- revokes only its source; unrelated active grants remain untouched.
  if tg_op = 'UPDATE'
     and old.status = 'approved'::public.payment_status
     and (new.status <> 'approved'::public.payment_status
       or old.user_id is distinct from new.user_id) then
    update public.ivg_access_grants as grants
    set state = 'revoked'::public.ivg_grant_state,
        version = grants.version + 1,
        reason_code = 'legacy_payment_request_reversed',
        updated_at = pg_catalog.now()
    where grants.user_id = old.user_id
      and grants.product = 'walkingpov'::public.ivg_product
      and grants.source_type = 'legacy_payment_request'::public.ivg_grant_source
      and grants.source_id = old.id::text
      and grants.state <> 'revoked'::public.ivg_grant_state;
  end if;

  if new.status = 'approved'::public.payment_status then
    insert into public.ivg_access_grants as existing_grant (
      user_id,
      product,
      source_type,
      source_id,
      state,
      version,
      reason_code
    ) values (
      new.user_id,
      'walkingpov'::public.ivg_product,
      'legacy_payment_request'::public.ivg_grant_source,
      new.id::text,
      'active'::public.ivg_grant_state,
      1,
      'legacy_payment_approved'
    )
    on conflict (user_id, product, source_type, source_id) do update
    set state = 'active'::public.ivg_grant_state,
        version = existing_grant.version + 1,
        reason_code = 'legacy_payment_approved',
        updated_at = pg_catalog.now()
    where existing_grant.state <> 'active'::public.ivg_grant_state;
  end if;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    perform public.recompute_ivg_membership(old.user_id);
  end if;
  perform public.recompute_ivg_membership(new.user_id);
  return new;
end;
$function$;

create trigger ivg_recompute_after_payment_change
after insert or update of status or delete on public.payment_requests
for each row
execute function public.ivg_recompute_after_payment_change();

create or replace function public.apply_ivg_entitlement_event(
  p_event_id varchar(160),
  p_payload_hash bytea,
  p_user_id uuid,
  p_source_type public.ivg_grant_source,
  p_source_id varchar(160),
  p_grant_state public.ivg_grant_state,
  p_grant_version bigint
)
returns table(applied boolean, current_version bigint)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  inbox_inserted integer;
  grant_changed integer;
  current_grant_version bigint;
  prior_payload_hash bytea;
begin
  if p_event_id is null or pg_catalog.char_length(p_event_id) not between 1 and 160
     or p_payload_hash is null or pg_catalog.octet_length(p_payload_hash) <> 32
     or p_user_id is null
     or p_source_id is null or pg_catalog.char_length(p_source_id) not between 1 and 160
     or p_grant_version is null or p_grant_version < 1 then
    raise exception 'invalid_entitlement_event';
  end if;

  -- This internal endpoint may only grant the WalkingPOV product. A direct
  -- InstantVidGrab purchase must never become WalkingPOV premium by account link.
  if p_source_type not in (
    'whop_payment'::public.ivg_grant_source,
    'complimentary'::public.ivg_grant_source,
    'manual'::public.ivg_grant_source
  ) then
    raise exception 'invalid_entitlement_source';
  end if;

  insert into public.ivg_integration_inbox (
    source,
    event_id,
    event_type,
    payload_hash,
    state,
    attempts,
    next_attempt_at,
    received_at,
    completed_at
  ) values (
    'instantvidgrab',
    p_event_id,
    'entitlement.changed',
    p_payload_hash,
    'processed'::public.ivg_event_state,
    0,
    pg_catalog.now(),
    pg_catalog.now(),
    pg_catalog.now()
  )
  on conflict (source, event_id) do nothing;
  get diagnostics inbox_inserted = row_count;

  if inbox_inserted = 0 then
    select inbox.payload_hash
    into prior_payload_hash
    from public.ivg_integration_inbox as inbox
    where inbox.source = 'instantvidgrab'
      and inbox.event_id = p_event_id
    for update;

    if prior_payload_hash is distinct from p_payload_hash then
      raise exception 'entitlement_event_payload_conflict';
    end if;

    select grants.version
    into current_grant_version
    from public.ivg_access_grants as grants
    where grants.user_id = p_user_id
      and grants.product = 'walkingpov'::public.ivg_product
      and grants.source_type = p_source_type
      and grants.source_id = p_source_id;

    return query select false, coalesce(current_grant_version, 0);
    return;
  end if;

  insert into public.ivg_access_grants as existing_grant (
    user_id,
    product,
    source_type,
    source_id,
    state,
    version,
    reason_code
  ) values (
    p_user_id,
    'walkingpov'::public.ivg_product,
    p_source_type,
    p_source_id,
    p_grant_state,
    p_grant_version,
    'ivg_entitlement_event'
  )
  on conflict (user_id, product, source_type, source_id) do update
  set state = excluded.state,
      version = excluded.version,
      reason_code = excluded.reason_code,
      updated_at = pg_catalog.now()
  where existing_grant.version < excluded.version;
  get diagnostics grant_changed = row_count;

  select grants.version
  into current_grant_version
  from public.ivg_access_grants as grants
  where grants.user_id = p_user_id
    and grants.product = 'walkingpov'::public.ivg_product
    and grants.source_type = p_source_type
    and grants.source_id = p_source_id;

  return query select grant_changed = 1, current_grant_version;
end;
$function$;

create or replace function public.claim_ivg_integration_outbox(
  p_worker_id varchar(80),
  p_lease_seconds integer default 60
)
returns table(
  id uuid,
  idempotency_key varchar(191),
  kind varchar(80),
  aggregate_id varchar(160),
  payload jsonb,
  attempts smallint,
  lease_token uuid,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  lease_seconds integer := greatest(15, least(300, coalesce(p_lease_seconds, 60)));
begin
  if p_worker_id is null or pg_catalog.char_length(pg_catalog.btrim(p_worker_id)) not between 1 and 80 then
    raise exception 'invalid_worker_id';
  end if;

  update public.ivg_integration_outbox as outbox
  set state = 'dead_letter'::public.ivg_job_state,
      failure_code = 'lease_expired_max_attempts',
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      completed_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where outbox.state = 'leased'::public.ivg_job_state
    and outbox.attempts >= 8
    and outbox.lease_expires_at <= pg_catalog.now();

  return query
  with candidate as (
    select outbox.id
    from public.ivg_integration_outbox as outbox
    where outbox.attempts < 8
      and (
        (outbox.state = 'queued'::public.ivg_job_state and outbox.next_attempt_at <= pg_catalog.now())
        or (outbox.state = 'leased'::public.ivg_job_state and outbox.lease_expires_at <= pg_catalog.now())
      )
    order by coalesce(outbox.lease_expires_at, outbox.next_attempt_at), outbox.created_at
    for update skip locked
    limit 1
  )
  update public.ivg_integration_outbox as outbox
  set state = 'leased'::public.ivg_job_state,
      attempts = outbox.attempts + 1,
      lease_owner = p_worker_id,
      lease_token = pg_catalog.gen_random_uuid(),
      lease_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => lease_seconds),
      completed_at = null,
      updated_at = pg_catalog.now()
  from candidate
  where outbox.id = candidate.id
  returning outbox.id, outbox.idempotency_key, outbox.kind,
    outbox.aggregate_id, outbox.payload, outbox.attempts,
    outbox.lease_token, outbox.lease_expires_at;
end;
$function$;

create or replace function public.complete_ivg_integration_outbox(
  p_id uuid,
  p_lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  changed integer;
begin
  update public.ivg_integration_outbox as outbox
  set state = 'completed'::public.ivg_job_state,
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      completed_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where outbox.id = p_id
    and outbox.state = 'leased'::public.ivg_job_state
    and outbox.lease_token = p_lease_token;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$function$;

create or replace function public.fail_ivg_integration_outbox(
  p_id uuid,
  p_lease_token uuid,
  p_error_code varchar(80),
  p_retry_after_seconds integer default 30
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  changed integer;
  retry_seconds integer := greatest(1, least(3600, coalesce(p_retry_after_seconds, 30)));
begin
  if p_error_code is null or p_error_code !~ '^[a-zA-Z0-9_.-]{1,80}$' then
    raise exception 'invalid_error_code';
  end if;

  update public.ivg_integration_outbox as outbox
  set state = case
        when outbox.attempts >= 8 then 'dead_letter'::public.ivg_job_state
        else 'queued'::public.ivg_job_state
      end,
      next_attempt_at = pg_catalog.now() + pg_catalog.make_interval(secs => retry_seconds),
      failure_code = p_error_code,
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      completed_at = case when outbox.attempts >= 8 then pg_catalog.now() else null end,
      updated_at = pg_catalog.now()
  where outbox.id = p_id
    and outbox.state = 'leased'::public.ivg_job_state
    and outbox.lease_token = p_lease_token;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$function$;

alter table public.ivg_access_grants enable row level security;
alter table public.ivg_identity_links enable row level security;
alter table public.ivg_auth_codes enable row level security;
alter table public.ivg_integration_inbox enable row level security;
alter table public.ivg_integration_outbox enable row level security;
alter table public.ivg_internal_nonces enable row level security;

revoke all on table public.ivg_access_grants, public.ivg_identity_links,
  public.ivg_auth_codes, public.ivg_integration_inbox,
  public.ivg_integration_outbox, public.ivg_internal_nonces
from public, anon, authenticated;

grant select, insert, update, delete on table public.ivg_access_grants,
  public.ivg_identity_links, public.ivg_auth_codes,
  public.ivg_integration_inbox, public.ivg_integration_outbox,
  public.ivg_internal_nonces to service_role;

create policy ivg_server_access on public.ivg_access_grants
  for all to service_role using (true) with check (true);
create policy ivg_server_access on public.ivg_identity_links
  for all to service_role using (true) with check (true);
create policy ivg_server_access on public.ivg_auth_codes
  for all to service_role using (true) with check (true);
create policy ivg_server_access on public.ivg_integration_inbox
  for all to service_role using (true) with check (true);
create policy ivg_server_access on public.ivg_integration_outbox
  for all to service_role using (true) with check (true);
create policy ivg_server_access on public.ivg_internal_nonces
  for all to service_role using (true) with check (true);

revoke all on type public.ivg_product, public.ivg_grant_source,
  public.ivg_grant_state, public.ivg_link_state, public.ivg_event_state,
  public.ivg_job_state from public, anon, authenticated;
grant usage on type public.ivg_product, public.ivg_grant_source,
  public.ivg_grant_state, public.ivg_link_state, public.ivg_event_state,
  public.ivg_job_state to service_role;

revoke all on function public.recompute_ivg_membership(uuid)
  from public, anon, authenticated;
grant execute on function public.recompute_ivg_membership(uuid) to service_role;
revoke all on function public.ivg_guard_membership_downgrade()
  from public, anon, authenticated;
revoke all on function public.ivg_recompute_after_grant_change()
  from public, anon, authenticated;
revoke all on function public.ivg_recompute_after_payment_change()
  from public, anon, authenticated;
revoke all on function public.apply_ivg_entitlement_event(varchar, bytea, uuid, public.ivg_grant_source, varchar, public.ivg_grant_state, bigint)
  from public, anon, authenticated;
grant execute on function public.apply_ivg_entitlement_event(varchar, bytea, uuid, public.ivg_grant_source, varchar, public.ivg_grant_state, bigint)
  to service_role;
revoke all on function public.claim_ivg_integration_outbox(varchar, integer)
  from public, anon, authenticated;
grant execute on function public.claim_ivg_integration_outbox(varchar, integer)
  to service_role;
revoke all on function public.complete_ivg_integration_outbox(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.complete_ivg_integration_outbox(uuid, uuid)
  to service_role;
revoke all on function public.fail_ivg_integration_outbox(uuid, uuid, varchar, integer)
  from public, anon, authenticated;
grant execute on function public.fail_ivg_integration_outbox(uuid, uuid, varchar, integer)
  to service_role;
