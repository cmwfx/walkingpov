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
as $function$
declare
  request_row public.payment_requests%rowtype;
  user_row public.users%rowtype;
  email_subject text;
  email_text text;
  email_html text;
  result_heading text;
  result_message text;
  note_text text;
  note_html text;
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

  note_text := nullif(trim(coalesce(p_notes, '')), '');
  note_html := case
    when note_text is null then ''
    else '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">'
      || '<tr><td style="padding:16px 18px;background:#0f172a;border:1px solid #6d3fc0;border-radius:12px;">'
      || '<div style="margin:0 0 8px;color:#d58cff;font-size:13px;line-height:20px;font-weight:700;">Message from CandidFan support</div>'
      || '<div style="color:#e5e7eb;font-size:15px;line-height:24px;white-space:pre-wrap;">'
      || replace(replace(replace(replace(replace(note_text, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;')
      || '</div></td></tr></table>'
  end;

  result_heading := case when p_decision = 'approved' then 'Payment approved' else 'Payment review complete' end;
  result_message := case when p_decision = 'approved'
    then 'Your CandidFan payment was approved. Sign in to access your lifetime membership.'
    else 'Your CandidFan payment was reviewed. Sign in to review the result and contact support if you need help.' end;
  email_subject := case when p_decision = 'approved' then 'Your CandidFan membership is active' else 'Your CandidFan payment review is complete' end;
  email_text := result_message || case when note_text is null then '' else chr(10) || chr(10) || 'Message from CandidFan support:' || chr(10) || note_text end;
  email_html := '<!doctype html>'
    || '<html lang="en"><body style="margin:0;background:#0b1224;color:#e5e7eb;font-family:Arial,Helvetica,sans-serif;">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b1224;"><tr><td align="center" style="padding:40px 16px;">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#141d33;border:1px solid #2b3852;border-radius:16px;">'
    || '<tr><td style="padding:28px 32px 12px;"><div style="font-size:22px;line-height:28px;font-weight:700;color:#d58cff;">CandidFan</div></td></tr>'
    || '<tr><td style="padding:12px 32px 32px;"><h1 style="margin:0;color:#f8fafc;font-size:24px;line-height:32px;font-weight:700;">'
    || result_heading
    || '</h1><p style="margin:16px 0 0;color:#a9b7d0;font-size:16px;line-height:25px;">'
    || result_message
    || '</p>'
    || note_html
    || '<p style="margin:24px 0 0;"><a href="https://candidfan.com/dashboard" style="display:inline-block;padding:12px 18px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;line-height:20px;font-weight:700;">Open CandidFan</a></p>'
    || '</td></tr><tr><td style="padding:18px 32px 24px;border-top:1px solid #253149;"><p style="margin:0;color:#71809b;font-size:12px;line-height:19px;">CandidFan &middot; Payment review</p></td></tr>'
    || '</table></td></tr></table></body></html>';

  insert into public.email_outbox(kind, recipient, subject, text_body, html_body)
  values ('payment_review', user_row.email, email_subject, email_text, email_html);

  insert into public.audit_logs(actor_id, action, resource_type, resource_id, details)
  values (p_admin_id, 'payment_reviewed', 'payment_request', p_request_id,
    jsonb_build_object('decision', p_decision));

  return query select p_request_id, request_row.user_id, user_row.email, p_decision;
end;
$function$;
