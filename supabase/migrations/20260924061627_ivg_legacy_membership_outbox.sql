-- Durably synchronize legacy WalkingPOV membership to an already-verified
-- InstantVidGrab account. Outbox events contain only the two opaque account IDs
-- and a deterministic event ID; the worker reads the current grant snapshot
-- when it delivers, so concurrent grant changes cannot publish stale state.

create or replace function public.ivg_enqueue_legacy_membership_outbox(
  p_walkingpov_user_id uuid,
  p_change_id varchar(80)
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  linked_instantvidgrab_user_id varchar(36);
  event_id varchar(160);
  idempotency_key varchar(191);
begin
  if p_walkingpov_user_id is null
     or p_change_id is null
     or pg_catalog.char_length(p_change_id) not between 1 and 80
     or p_change_id !~ '^[a-zA-Z0-9_-]+$' then
    raise exception 'invalid_legacy_membership_change';
  end if;

  select links.instantvidgrab_user_id
  into linked_instantvidgrab_user_id
  from public.ivg_identity_links as links
  where links.walkingpov_user_id = p_walkingpov_user_id
    and links.state = 'verified'::public.ivg_link_state;

  if not found then
    return;
  end if;

  event_id := 'wpv_legacy_membership_' || p_walkingpov_user_id::text || '_' || p_change_id;
  idempotency_key := 'wpv-legacy-membership:' || p_walkingpov_user_id::text || ':' || p_change_id;

  insert into public.ivg_integration_outbox (
    idempotency_key,
    kind,
    aggregate_id,
    payload,
    state,
    attempts,
    next_attempt_at
  ) values (
    idempotency_key,
    'legacy_membership_snapshot',
    p_walkingpov_user_id::text,
    pg_catalog.jsonb_build_object(
      'eventId', event_id,
      'walkingpovUserId', p_walkingpov_user_id::text,
      'instantvidgrabUserId', linked_instantvidgrab_user_id
    ),
    'queued'::public.ivg_job_state,
    0,
    pg_catalog.now()
  )
  on conflict (idempotency_key) do nothing;
end;
$function$;

create or replace function public.ivg_queue_legacy_membership_after_grant_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
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

create trigger ivg_queue_legacy_membership_after_grant_change
after insert or update of user_id, product, state, version or delete
on public.ivg_access_grants
for each row
execute function public.ivg_queue_legacy_membership_after_grant_change();

create or replace function public.ivg_queue_legacy_membership_after_link_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.state = 'verified'::public.ivg_link_state then
      perform public.ivg_enqueue_legacy_membership_outbox(
        new.walkingpov_user_id,
        'link_' || new.walkingpov_user_id::text
      );
    end if;
    return new;
  end if;

  if new.state = 'verified'::public.ivg_link_state
     and (old.state is distinct from new.state
       or old.instantvidgrab_user_id is distinct from new.instantvidgrab_user_id) then
    perform public.ivg_enqueue_legacy_membership_outbox(
      new.walkingpov_user_id,
      'link_' || new.walkingpov_user_id::text
    );
  end if;
  return new;
end;
$function$;

create trigger ivg_queue_legacy_membership_after_link_change
after insert or update of state, instantvidgrab_user_id
on public.ivg_identity_links
for each row
execute function public.ivg_queue_legacy_membership_after_link_change();

revoke all on function public.ivg_enqueue_legacy_membership_outbox(uuid, varchar)
  from public, anon, authenticated;
revoke all on function public.ivg_queue_legacy_membership_after_grant_change()
  from public, anon, authenticated;
revoke all on function public.ivg_queue_legacy_membership_after_link_change()
  from public, anon, authenticated;

grant execute on function public.ivg_enqueue_legacy_membership_outbox(uuid, varchar)
  to service_role;

comment on function public.ivg_enqueue_legacy_membership_outbox(uuid, varchar)
  is 'Queues a provider-neutral legacy membership snapshot for a verified InstantVidGrab identity link.';
