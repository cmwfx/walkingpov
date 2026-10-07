-- Whop-free, signed subscription mirror; callable only by the service role.
create or replace function public.apply_ivg_subscription_event(
  p_event_id text, p_payload_hash bytea, p_user_id uuid, p_ivg_user_id text,
  p_source_id text, p_grant_state public.ivg_grant_state, p_version bigint,
  p_paid_through timestamptz, p_period_end timestamptz, p_status text,
  p_cancel_at_period_end boolean, p_cancellation_pending boolean
) returns bigint language plpgsql security definer set search_path = '' as $fn$
declare current_version bigint; existing_hash bytea;
begin
  if p_source_id !~ '^sub_[a-f0-9]{32}$' or p_version < 1
     or octet_length(p_payload_hash) <> 32 or char_length(p_event_id) > 160
     or (p_grant_state = 'active' and p_paid_through is null) then
    raise exception 'invalid_subscription_event';
  end if;
  perform 1 from public.users where id = p_user_id for update;
  if not found then raise exception 'account_unavailable'; end if;
  if not exists (select 1 from public.ivg_identity_links where walkingpov_user_id=p_user_id and instantvidgrab_user_id=p_ivg_user_id and state='verified') then
    raise exception 'identity_link_conflict';
  end if;
  select payload_hash into existing_hash from public.ivg_integration_inbox where source='instantvidgrab' and event_id=p_event_id;
  if found and existing_hash is distinct from p_payload_hash then raise exception 'event_payload_conflict'; end if;
  select version into current_version from public.ivg_subscriptions where source_id=p_source_id;
  if exists (select 1 from public.ivg_subscriptions where source_id=p_source_id and (user_id<>p_user_id or instantvidgrab_user_id<>p_ivg_user_id)) then raise exception 'subscription_owner_conflict'; end if;
  if coalesce(current_version,0) >= p_version then return current_version; end if;
  insert into public.ivg_integration_inbox(source,event_id,event_type,payload_hash,state,completed_at)
  values ('instantvidgrab',p_event_id,'subscription.changed',p_payload_hash,'processed',now()) on conflict(source,event_id) do nothing;
  insert into public.ivg_subscriptions(source_id,user_id,instantvidgrab_user_id,status,grant_state,paid_through,current_period_end,cancel_at_period_end,cancellation_pending,version)
  values(p_source_id,p_user_id,p_ivg_user_id,p_status,p_grant_state,p_paid_through,p_period_end,p_cancel_at_period_end,p_cancellation_pending,p_version)
  on conflict(source_id) do update set status=excluded.status,grant_state=excluded.grant_state,paid_through=excluded.paid_through,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,cancellation_pending=excluded.cancellation_pending,version=excluded.version,updated_at=now();
  insert into public.ivg_access_grants(user_id,product,source_type,source_id,state,version,expires_at,reason_code)
  values(p_user_id,'walkingpov','instantvidgrab_subscription',p_source_id,p_grant_state,p_version,p_paid_through,'monthly_subscription')
  on conflict(user_id,product,source_type,source_id) do update set state=excluded.state,version=excluded.version,expires_at=excluded.expires_at,updated_at=now();
  return p_version;
end;$fn$;
revoke all on function public.apply_ivg_subscription_event(text,bytea,uuid,text,text,public.ivg_grant_state,bigint,timestamptz,timestamptz,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.apply_ivg_subscription_event(text,bytea,uuid,text,text,public.ivg_grant_state,bigint,timestamptz,timestamptz,text,boolean,boolean) to service_role;

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
      and (grants.expires_at is null or grants.expires_at > pg_catalog.now())
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
      and (grants.expires_at is null or grants.expires_at > pg_catalog.now())
     ) then
    new.membership_status := 'premium'::public.membership_status;
    new.updated_at := pg_catalog.now();
  end if;
  return new;
end;
$function$;




create or replace function public.ivg_queue_legacy_membership_after_grant_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' and old.source_type = 'instantvidgrab_subscription'::public.ivg_grant_source then return old; end if;
  if tg_op <> 'DELETE' and new.source_type = 'instantvidgrab_subscription'::public.ivg_grant_source then return new; end if;
  if tg_op = 'DELETE' then
    if old.product = 'walkingpov'::public.ivg_product then
      perform public.ivg_enqueue_legacy_membership_outbox(
        old.user_id,
        'grant_' || old.id::text || '_v' || old.version::text || '_deleted'
      );
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.product = 'walkingpov'::public.ivg_product
       and (old.user_id is distinct from new.user_id
         or new.product is distinct from old.product) then
      perform public.ivg_enqueue_legacy_membership_outbox(
        old.user_id,
        'grant_' || old.id::text || '_v' || old.version::text || '_moved'
      );
    end if;
  end if;

  if new.product = 'walkingpov'::public.ivg_product then
    perform public.ivg_enqueue_legacy_membership_outbox(
      new.user_id,
      'grant_' || new.id::text || '_v' || new.version::text || '_' || new.state::text
    );
  end if;
  return new;
end;
$function$;