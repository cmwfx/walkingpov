-- Avoid shadowing the integration outbox's idempotency_key column in PL/pgSQL.
-- A verified identity link invokes this function via a trigger; the unqualified
-- ON CONFLICT target becomes ambiguous if a PL/pgSQL variable has the same name.

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
  v_idempotency_key varchar(191);
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
  v_idempotency_key := 'wpv-legacy-membership:' || p_walkingpov_user_id::text || ':' || p_change_id;

  insert into public.ivg_integration_outbox (
    idempotency_key,
    kind,
    aggregate_id,
    payload,
    state,
    attempts,
    next_attempt_at
  ) values (
    v_idempotency_key,
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

revoke all on function public.ivg_enqueue_legacy_membership_outbox(uuid, varchar)
  from public, anon, authenticated;
grant execute on function public.ivg_enqueue_legacy_membership_outbox(uuid, varchar)
  to service_role;
comment on function public.ivg_enqueue_legacy_membership_outbox(uuid, varchar)
  is 'Queues a provider-neutral legacy membership snapshot for a verified InstantVidGrab identity link.';
