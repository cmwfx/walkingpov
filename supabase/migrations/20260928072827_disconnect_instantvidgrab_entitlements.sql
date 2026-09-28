-- Disconnect cross-site account synchronization without changing a single
-- current membership status, payment request, access grant, or link record.
drop trigger if exists ivg_guard_membership_downgrade on public.users;
drop trigger if exists ivg_recompute_after_grant_change on public.ivg_access_grants;
drop trigger if exists ivg_recompute_after_payment_change on public.payment_requests;
drop trigger if exists ivg_queue_legacy_membership_after_grant_change on public.ivg_access_grants;
drop trigger if exists ivg_queue_legacy_membership_after_link_change on public.ivg_identity_links;

-- Jobs were produced exclusively for the retired cross-site integration. Keep
-- their payloads and identifiers for audit/rollback, but make them unclaimable.
update public.ivg_integration_outbox
set state = 'dead_letter'::public.ivg_job_state,
    lease_owner = null,
    lease_token = null,
    lease_expires_at = null,
    failure_code = coalesce(failure_code, 'site_integration_removed'),
    completed_at = coalesce(completed_at, pg_catalog.now()),
    updated_at = pg_catalog.now()
where state in ('queued'::public.ivg_job_state, 'leased'::public.ivg_job_state);

-- Preserve a lifetime CandidFan entitlement even if a historic pending gift
-- card is subsequently denied. The payment request still records the review.
create or replace function public.review_payment_request(
  p_request_id uuid,
  p_admin_id uuid,
  p_decision public.payment_status,
  p_notes text default null
)
returns table(request_id uuid, user_id uuid, recipient text, decision public.payment_status)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  request_row public.payment_requests%rowtype;
  user_row public.users%rowtype;
  email_subject text;
  email_text text;
  email_html text;
begin
  if p_decision not in ('approved', 'denied') then
    raise exception 'invalid_decision';
  end if;
  if not exists (select 1 from public.users where id = p_admin_id and is_admin) then
    raise exception 'admin_required';
  end if;

  select * into request_row from public.payment_requests
  where id = p_request_id for update;
  if request_row.id is null then raise exception 'request_not_found'; end if;
  if request_row.status <> 'pending' then raise exception 'request_already_reviewed'; end if;

  select * into user_row from public.users where id = request_row.user_id for update;
  update public.payment_requests
  set status = p_decision, reviewed_by = p_admin_id, reviewed_at = pg_catalog.now(),
      notes = nullif(trim(p_notes), ''), updated_at = pg_catalog.now()
  where id = p_request_id;

  update public.users
  set membership_status = case
        when user_row.membership_status = 'premium'::public.membership_status
          then 'premium'::public.membership_status
        when p_decision = 'approved' then 'premium'::public.membership_status
        else 'denied'::public.membership_status
      end,
      updated_at = pg_catalog.now()
  where id = request_row.user_id;

  email_subject := case when p_decision = 'approved' then 'Your CandidFan membership is active' else 'Your CandidFan payment review is complete' end;
  email_text := case when p_decision = 'approved'
    then 'Your CandidFan payment was approved. Sign in to access your lifetime membership.'
    else 'Your CandidFan payment was reviewed. Sign in to review the result and contact support if you need help.' end;
  email_html := '<p>' || email_text || '</p><p><a href="https://candidfan.com/dashboard">Open CandidFan</a></p>';
  insert into public.email_outbox(kind, recipient, subject, text_body, html_body)
  values ('payment_review', user_row.email, email_subject, email_text, email_html);

  insert into public.audit_logs(actor_id, action, resource_type, resource_id, details)
  values (p_admin_id, 'payment_reviewed', 'payment_request', p_request_id,
    pg_catalog.jsonb_build_object('decision', p_decision));

  return query select p_request_id, request_row.user_id, user_row.email, p_decision;
end;
$function$;

-- Service code no longer needs direct access to cross-site state or worker RPCs.
revoke all on table public.ivg_access_grants, public.ivg_identity_links,
  public.ivg_auth_codes, public.ivg_integration_inbox,
  public.ivg_integration_outbox, public.ivg_internal_nonces
  from public, anon, authenticated, service_role;

do $revoke_integration_routines$
declare
  routine_signature text;
begin
  for routine_signature in
    select p.oid::regprocedure::text
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'ivg_%' or p.proname = 'apply_ivg_entitlement_event')
  loop
    execute pg_catalog.format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      routine_signature
    );
  end loop;
end;
$revoke_integration_routines$;

notify pgrst, 'reload schema';
