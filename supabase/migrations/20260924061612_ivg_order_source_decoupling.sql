-- WalkingPOV receives a signed InstantVidGrab entitlement event only. It does
-- not integrate with, call, or receive provider-specific payment data from Whop.
-- Keep the old enum label for historical compatibility, but stop accepting it
-- on this integration path and use the provider-neutral InstantVidGrab order.

alter type public.ivg_grant_source
  add value if not exists 'instantvidgrab_order';

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

  -- This endpoint changes WalkingPOV grants only. Direct InstantVidGrab access
  -- never becomes WalkingPOV premium just because the accounts are linked.
  if p_source_type not in (
    'instantvidgrab_order'::public.ivg_grant_source,
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
