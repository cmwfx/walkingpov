create or replace function public.review_payment_request(
  p_request_id uuid,
  p_admin_id uuid,
  p_decision public.payment_status,
  p_notes text default null
)
returns table (request_id uuid, user_id uuid, recipient text, decision public.payment_status)
language plpgsql
security definer
set search_path = public
as $$
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
  set status = p_decision, reviewed_by = p_admin_id, reviewed_at = now(), notes = nullif(trim(p_notes), ''), updated_at = now()
  where id = p_request_id;

  update public.users
  set membership_status = case
        when p_decision = 'approved' then 'premium'::public.membership_status
        else 'denied'::public.membership_status
      end,
      updated_at = now()
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
    jsonb_build_object('decision', p_decision));

  return query select p_request_id, request_row.user_id, user_row.email, p_decision;
end;
$$;
