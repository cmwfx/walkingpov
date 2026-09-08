-- CandidFan production schema.
-- This migration intentionally contains no catalog or user data.

create extension if not exists pgcrypto;

create type public.membership_status as enum ('free', 'pending', 'premium', 'denied');
create type public.video_status as enum ('processing', 'ready', 'failed');
create type public.payment_status as enum ('pending', 'approved', 'denied');
create type public.ticket_status as enum ('open', 'closed');
create type public.outbox_status as enum ('pending', 'processing', 'sent', 'failed');
create type public.import_job_status as enum ('queued', 'running', 'completed', 'failed');
create type public.import_item_status as enum ('claimed', 'processing', 'completed', 'failed');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  membership_status public.membership_status not null default 'free',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 500),
  thumbnail_url text not null,
  tags text[] not null default '{}',
  status public.video_status not null default 'processing',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null unique references public.videos(id) on delete cascade,
  storage_key uuid not null unique,
  content_type text not null default 'video/mp4' check (content_type = 'video/mp4'),
  size_bytes bigint not null check (size_bytes > 0),
  source_identity text not null unique check (char_length(source_identity) = 64),
  created_at timestamptz not null default now()
);

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  proof_encrypted text not null,
  status public.payment_status not null default 'pending',
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index payment_requests_one_pending_per_user
  on public.payment_requests(user_id) where status = 'pending';

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 160),
  status public.ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now()
);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('payment_review', 'support_reply', 'test')),
  recipient text not null check (char_length(recipient) between 3 and 320),
  subject text not null check (char_length(subject) between 1 and 200),
  text_body text not null check (char_length(text_body) <= 20000),
  html_body text not null check (char_length(html_body) <= 40000),
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 8),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 80),
  created_at timestamptz not null default now()
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in ('originals', 'intake')),
  status public.import_job_status not null default 'queued',
  total_items integer not null default 0 check (total_items >= 0),
  processed_items integer not null default 0 check (processed_items >= 0),
  successful_items integer not null default 0 check (successful_items >= 0),
  failed_items integer not null default 0 check (failed_items >= 0),
  total_bytes bigint not null default 0 check (total_bytes >= 0),
  processed_bytes bigint not null default 0 check (processed_bytes >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.import_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.import_jobs(id) on delete cascade,
  source_identity text not null unique check (char_length(source_identity) = 64),
  title text not null check (char_length(title) between 1 and 500),
  source_size_bytes bigint not null check (source_size_bytes > 0),
  storage_key uuid not null unique,
  thumbnail_key uuid not null,
  status public.import_item_status not null default 'claimed',
  video_id uuid unique references public.videos(id) on delete set null,
  attempts integer not null default 0 check (attempts >= 0),
  error_code text check (error_code is null or char_length(error_code) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 100),
  resource_type text not null check (char_length(resource_type) between 1 and 80),
  resource_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index videos_ready_created_idx on public.videos(created_at desc) where status = 'ready';
create index videos_tags_idx on public.videos using gin(tags);
create index payment_requests_status_created_idx on public.payment_requests(status, created_at);
create index support_tickets_user_updated_idx on public.support_tickets(user_id, updated_at desc);
create index support_messages_ticket_created_idx on public.support_messages(ticket_id, created_at);
create index email_outbox_claim_idx on public.email_outbox(status, next_attempt_at, created_at);
create index import_jobs_status_created_idx on public.import_jobs(status, created_at);
create index import_items_job_status_idx on public.import_items(job_id, status);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger videos_set_updated_at before update on public.videos
  for each row execute function public.set_updated_at();
create trigger payment_requests_set_updated_at before update on public.payment_requests
  for each row execute function public.set_updated_at();
create trigger support_tickets_set_updated_at before update on public.support_tickets
  for each row execute function public.set_updated_at();
create trigger import_items_set_updated_at before update on public.import_items
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, lower(new.email))
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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
  return new_id;
end;
$$;

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
  set membership_status = case when p_decision = 'approved' then 'premium' else 'denied' end,
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
  return ticket_id;
end;
$$;

create or replace function public.add_support_message(
  p_ticket_id uuid,
  p_author_id uuid,
  p_body text,
  p_notify_email boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_row public.support_tickets%rowtype;
  author_row public.users%rowtype;
  message_id uuid;
begin
  select * into ticket_row from public.support_tickets where id = p_ticket_id for update;
  if ticket_row.id is null then raise exception 'ticket_not_found'; end if;
  select * into author_row from public.users where id = p_author_id;
  if author_row.id is null then raise exception 'user_not_found'; end if;
  if p_body is null or char_length(trim(p_body)) not between 1 and 10000 then raise exception 'invalid_body'; end if;

  insert into public.support_messages(ticket_id, author_id, body)
  values (p_ticket_id, p_author_id, trim(p_body)) returning id into message_id;
  update public.support_tickets set status = 'open', updated_at = now() where id = p_ticket_id;

  if p_notify_email and author_row.is_admin then
    insert into public.email_outbox(kind, recipient, subject, text_body, html_body)
    select 'support_reply', owner.email, 'A CandidFan support reply is available',
      'A support reply is available in your CandidFan account. Open your ticket to read it.',
      '<p>A support reply is available in your CandidFan account.</p><p><a href="https://candidfan.com/support/' || p_ticket_id::text || '">Open your support ticket</a></p>'
    from public.users owner where owner.id = ticket_row.user_id;
  end if;
  return message_id;
end;
$$;

create or replace function public.publish_import_item(
  p_item_id uuid,
  p_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  item_row public.import_items%rowtype;
  created_video_id uuid;
begin
  select * into item_row from public.import_items where id = p_item_id for update;
  if item_row.id is null then raise exception 'import_item_not_found'; end if;
  if item_row.status = 'completed' then return item_row.video_id; end if;
  if p_size_bytes <> item_row.source_size_bytes then raise exception 'size_mismatch'; end if;
  insert into public.videos(title, thumbnail_url, status)
  values (item_row.title, 'https://media.candidfan.com/thumb/placeholder.jpg', 'ready')
  returning id into created_video_id;
  insert into public.media_assets(video_id, storage_key, size_bytes, source_identity)
  values (created_video_id, item_row.storage_key, p_size_bytes, item_row.source_identity);
  update public.import_items
  set status = 'completed', video_id = created_video_id, error_code = null, updated_at = now()
  where id = p_item_id;
  return created_video_id;
exception when unique_violation then
  select import_items.video_id into created_video_id from public.import_items where id = p_item_id;
  if created_video_id is not null then
    update public.import_items set status = 'completed', updated_at = now() where id = p_item_id;
    return created_video_id;
  end if;
  raise;
end;
$$;

create or replace function public.claim_import_item(
  p_job_id uuid,
  p_source_identity text,
  p_title text,
  p_source_size_bytes bigint,
  p_storage_key uuid,
  p_thumbnail_key uuid
)
returns table (item_id uuid, item_status public.import_item_status, claimed_storage_key uuid, claimed_thumbnail_key uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  item_row public.import_items%rowtype;
begin
  insert into public.import_items(job_id, source_identity, title, source_size_bytes, storage_key, thumbnail_key)
  values (p_job_id, p_source_identity, p_title, p_source_size_bytes, p_storage_key, p_thumbnail_key)
  on conflict (source_identity) do nothing;
  select * into item_row from public.import_items where source_identity = p_source_identity for update;
  if item_row.status <> 'completed' then
    update public.import_items set status = 'processing', attempts = attempts + 1, error_code = null, updated_at = now()
    where id = item_row.id
    returning * into item_row;
  end if;
  return query select item_row.id, item_row.status, item_row.storage_key, item_row.thumbnail_key;
end;
$$;

create or replace function public.record_import_failure(p_item_id uuid, p_error_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.import_items
  set status = 'failed', error_code = left(coalesce(nullif(p_error_code, ''), 'processing_failed'), 80), updated_at = now()
  where id = p_item_id and status <> 'completed';
end;
$$;

create or replace function public.claim_next_email(p_worker_id text)
returns table (outbox_id uuid, kind text, recipient text, subject text, text_body text, html_body text)
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id uuid;
begin
  update public.email_outbox set status = 'failed', locked_at = null, last_error_code = 'worker_timeout'
  where status = 'processing' and locked_at < now() - interval '10 minutes';
  select id into row_id from public.email_outbox
  where status = 'pending' and next_attempt_at <= now()
  order by created_at
  for update skip locked limit 1;
  if row_id is null then return; end if;
  update public.email_outbox set status = 'processing', locked_at = now(), attempts = attempts + 1 where id = row_id;
  return query select id, email_outbox.kind, email_outbox.recipient, email_outbox.subject, email_outbox.text_body, email_outbox.html_body
    from public.email_outbox where id = row_id;
end;
$$;

create or replace function public.mark_email_sent(p_outbox_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.email_outbox set status = 'sent', sent_at = now(), locked_at = null where id = p_outbox_id;
$$;

create or replace function public.mark_email_failed(p_outbox_id uuid, p_error_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.email_outbox
  set status = case when attempts >= 8 then 'failed' else 'pending' end,
      next_attempt_at = now() + least((2 ^ greatest(attempts - 1, 0)) * interval '1 minute', interval '6 hours'),
      locked_at = null,
      last_error_code = left(coalesce(nullif(p_error_code, ''), 'delivery_failed'), 80)
  where id = p_outbox_id;
end;
$$;

alter table public.users enable row level security;
alter table public.videos enable row level security;
alter table public.media_assets enable row level security;
alter table public.payment_requests enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.email_outbox enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_items enable row level security;
alter table public.audit_logs enable row level security;

create policy users_select_own on public.users for select to authenticated using ((select auth.uid()) = id);
create policy videos_select_ready on public.videos for select to anon, authenticated using (status = 'ready');

revoke all on table public.users, public.media_assets, public.payment_requests, public.support_tickets,
  public.support_messages, public.email_outbox, public.import_jobs, public.import_items, public.audit_logs from anon, authenticated;
revoke insert, update, delete on table public.videos from anon, authenticated;
grant select on table public.videos to anon, authenticated;
grant select on table public.users to authenticated;

revoke all on function public.handle_new_user() from public;
revoke all on function public.submit_payment_request(uuid, text) from public;
revoke all on function public.review_payment_request(uuid, uuid, public.payment_status, text) from public;
revoke all on function public.create_support_ticket(uuid, text, text) from public;
revoke all on function public.add_support_message(uuid, uuid, text, boolean) from public;
revoke all on function public.publish_import_item(uuid, bigint) from public;
revoke all on function public.claim_import_item(uuid, text, text, bigint, uuid, uuid) from public;
revoke all on function public.record_import_failure(uuid, text) from public;
revoke all on function public.claim_next_email(text) from public;
revoke all on function public.mark_email_sent(uuid) from public;
revoke all on function public.mark_email_failed(uuid, text) from public;
grant execute on function public.submit_payment_request(uuid, text) to service_role;
grant execute on function public.review_payment_request(uuid, uuid, public.payment_status, text) to service_role;
grant execute on function public.create_support_ticket(uuid, text, text) to service_role;
grant execute on function public.add_support_message(uuid, uuid, text, boolean) to service_role;
grant execute on function public.publish_import_item(uuid, bigint) to service_role;
grant execute on function public.claim_import_item(uuid, text, text, bigint, uuid, uuid) to service_role;
grant execute on function public.record_import_failure(uuid, text) to service_role;
grant execute on function public.claim_next_email(text) to service_role;
grant execute on function public.mark_email_sent(uuid) to service_role;
grant execute on function public.mark_email_failed(uuid, text) to service_role;

alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
