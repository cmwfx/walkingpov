-- CandidFan production schema.
-- This is the first migration for the fresh Supabase project. Browser clients
-- never receive service-role access; the Express API owns privileged writes.

create type public.membership_status as enum ('free', 'premium');
create type public.video_status as enum ('draft', 'processing', 'published', 'failed');
create type public.payment_status as enum ('pending', 'approved', 'denied');
create type public.import_job_status as enum ('queued', 'scanning', 'processing', 'paused', 'completed', 'failed');
create type public.import_item_status as enum ('discovered', 'queued', 'processing', 'published', 'duplicate', 'failed', 'skipped');
create type public.ticket_status as enum ('open', 'closed');
create type public.outbox_status as enum ('pending', 'sending', 'sent', 'failed');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  membership_status public.membership_status not null default 'free',
  is_admin boolean not null default false,
  premium_granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 300),
  tags text[] not null default '{}',
  status public.video_status not null default 'draft',
  duration_seconds numeric(10,3) not null default 0 check (duration_seconds >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  public_preview_key text,
  public_thumbnail_key text,
  full_asset_key text,
  source_sha256 text,
  processing_version text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint videos_published_assets_check check (
    status <> 'published'
    or (public_preview_key is not null and public_thumbnail_key is not null and full_asset_key is not null)
  )
);

create table public.video_assets (
  video_id uuid primary key references public.videos(id) on delete cascade,
  source_key text not null,
  work_key text,
  source_name text not null,
  source_sha256 text not null,
  source_size_bytes bigint not null check (source_size_bytes >= 0),
  source_mime text,
  source_duration_seconds numeric(10,3),
  source_codec text,
  output_size_bytes bigint,
  preview_size_bytes bigint,
  thumbnail_keys jsonb not null default '{}'::jsonb,
  processing_config jsonb not null default '{}'::jsonb,
  safe_to_delete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_sha256)
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  status public.import_job_status not null default 'queued',
  requested_by uuid references public.users(id) on delete set null,
  worker_id text,
  lease_until timestamptz,
  heartbeat_at timestamptz,
  pause_requested boolean not null default false,
  discovered_count integer not null default 0,
  queued_count integer not null default 0,
  processing_count integer not null default 0,
  published_count integer not null default 0,
  duplicate_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.import_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.import_jobs(id) on delete cascade,
  source_name text not null,
  source_size_bytes bigint not null check (source_size_bytes >= 0),
  source_mtime_ms bigint not null,
  fingerprint text not null,
  status public.import_item_status not null default 'discovered',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  worker_id text,
  lease_until timestamptz,
  heartbeat_at timestamptz,
  video_id uuid references public.videos(id) on delete set null,
  source_sha256 text,
  error_message text,
  copy_verified_at timestamptz,
  safe_to_delete boolean not null default false,
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, fingerprint)
);

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount_minor integer not null default 5000 check (amount_minor > 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  encrypted_proof text not null,
  status public.payment_status not null default 'pending',
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 200),
  status public.ticket_status not null default 'open',
  user_last_read_at timestamptz,
  admin_last_read_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_user_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  kind text not null,
  recipient text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index videos_publication_created_idx on public.videos (published_at desc, created_at desc) where status = 'published';
create index videos_tags_idx on public.videos using gin (tags);
create index videos_source_hash_idx on public.videos (source_sha256) where source_sha256 is not null;
create index video_assets_sha_idx on public.video_assets (source_sha256);
create index import_jobs_claim_idx on public.import_jobs (status, created_at) where status in ('queued', 'scanning', 'processing');
create index import_items_claim_idx on public.import_items (status, lease_until, discovered_at) where status in ('discovered', 'queued', 'processing');
create index import_items_job_idx on public.import_items (job_id, status);
create index payment_requests_user_idx on public.payment_requests (user_id, created_at desc);
create index payment_requests_review_idx on public.payment_requests (created_at) where status = 'pending';
create unique index payment_requests_one_pending_idx on public.payment_requests (user_id) where status = 'pending';
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index support_tickets_owner_activity_idx on public.support_tickets (owner_user_id, last_activity_at desc);
create index support_tickets_activity_idx on public.support_tickets (last_activity_at desc);
create index support_messages_ticket_created_idx on public.support_messages (ticket_id, created_at);
create index email_outbox_claim_idx on public.email_outbox (status, next_attempt_at) where status in ('pending', 'failed');

alter table public.users enable row level security;
alter table public.videos enable row level security;
alter table public.video_assets enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_items enable row level security;
alter table public.payment_requests enable row level security;
alter table public.audit_logs enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.email_outbox enable row level security;

-- The API uses the service role for privileged operations. The only direct
-- browser read permitted is a user's own safe profile row.
create policy users_select_own on public.users
  for select to authenticated
  using ((select auth.uid()) = id);

create policy payment_requests_select_own on public.payment_requests
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy support_tickets_select_own on public.support_tickets
  for select to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy support_messages_select_own on public.support_messages
  for select to authenticated
  using (exists (
    select 1 from public.support_tickets t
    where t.id = support_messages.ticket_id
      and t.owner_user_id = (select auth.uid())
  ));

-- No direct browser policies exist for media metadata, jobs, assets, audits, or
-- outbox rows. This prevents accidental exposure of private keys and proofs.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
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

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at before update on public.users for each row execute function public.handle_updated_at();
create trigger videos_updated_at before update on public.videos for each row execute function public.handle_updated_at();
create trigger video_assets_updated_at before update on public.video_assets for each row execute function public.handle_updated_at();
create trigger import_jobs_updated_at before update on public.import_jobs for each row execute function public.handle_updated_at();
create trigger import_items_updated_at before update on public.import_items for each row execute function public.handle_updated_at();
create trigger payment_requests_updated_at before update on public.payment_requests for each row execute function public.handle_updated_at();
create trigger support_tickets_updated_at before update on public.support_tickets for each row execute function public.handle_updated_at();
create trigger email_outbox_updated_at before update on public.email_outbox for each row execute function public.handle_updated_at();

create or replace function public.submit_payment_request(
  p_user_id uuid,
  p_encrypted_proof text,
  p_amount_minor integer default 5000,
  p_currency text default 'EUR'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_amount_minor <> 5000 or p_currency <> 'EUR' then
    raise exception using errcode = '22023', message = 'Only the configured EUR 50 offer is accepted';
  end if;
  if p_encrypted_proof is null or char_length(p_encrypted_proof) > 4096 then
    raise exception using errcode = '22023', message = 'Invalid gift-card proof';
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception using errcode = '23503', message = 'User profile not found';
  end if;
  insert into public.payment_requests (user_id, amount_minor, currency, encrypted_proof)
  values (p_user_id, p_amount_minor, p_currency, p_encrypted_proof)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception using errcode = '23505', message = 'A payment request is already pending';
end;
$$;

create or replace function public.review_payment(
  p_payment_id uuid,
  p_reviewer_id uuid,
  p_decision public.payment_status,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payment_requests%rowtype;
  v_user public.users%rowtype;
  v_changed boolean := false;
begin
  if p_decision not in ('approved', 'denied') then
    raise exception using errcode = '22023', message = 'Invalid review decision';
  end if;
  if not exists (select 1 from public.users where id = p_reviewer_id and is_admin) then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;
  select * into v_payment from public.payment_requests where id = p_payment_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Payment request not found';
  end if;
  select * into v_user from public.users where id = v_payment.user_id for update;
  if v_payment.status = 'pending' then
    update public.payment_requests
      set status = p_decision, reviewed_by = p_reviewer_id, reviewed_at = now(), notes = nullif(left(coalesce(p_notes, ''), 1000), '')
      where id = p_payment_id;
    if p_decision = 'approved' then
      update public.users
        set membership_status = 'premium', premium_granted_at = coalesce(premium_granted_at, now())
        where id = v_user.id;
    end if;
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (p_reviewer_id, 'payment_' || p_decision::text, 'payment_request', p_payment_id,
      jsonb_build_object('user_id', v_user.id, 'amount_minor', v_payment.amount_minor, 'currency', v_payment.currency));
    insert into public.email_outbox (dedupe_key, kind, recipient, subject, payload)
    values (
      'payment:' || p_payment_id::text || ':' || p_decision::text,
      'payment_review', v_user.email,
      case when p_decision = 'approved' then 'Your CandidFan access is ready' else 'Your CandidFan payment needs attention' end,
      jsonb_build_object('status', p_decision, 'notes', p_notes)
    ) on conflict (dedupe_key) do nothing;
    v_changed := true;
  end if;
  return jsonb_build_object('payment_id', p_payment_id, 'status', v_payment.status, 'changed', v_changed);
end;
$$;

create or replace function public.create_support_message(
  p_ticket_id uuid,
  p_author_id uuid,
  p_body text,
  p_send_email boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket public.support_tickets%rowtype;
  v_author public.users%rowtype;
  v_message_id uuid;
  v_recipient text;
begin
  if p_body is null or char_length(trim(p_body)) not between 1 and 5000 then
    raise exception using errcode = '22023', message = 'Message must be between 1 and 5000 characters';
  end if;
  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Ticket not found'; end if;
  select * into v_author from public.users where id = p_author_id;
  if not found then raise exception using errcode = 'P0002', message = 'Author not found'; end if;
  if not v_author.is_admin and v_ticket.owner_user_id <> p_author_id then
    raise exception using errcode = '42501', message = 'Ticket access denied';
  end if;
  insert into public.support_messages (ticket_id, author_user_id, body)
  values (p_ticket_id, p_author_id, trim(p_body))
  returning id into v_message_id;
  update public.support_tickets
    set status = 'open', last_activity_at = now(),
        user_last_read_at = case when v_author.is_admin then user_last_read_at else now() end,
        admin_last_read_at = case when v_author.is_admin then now() else admin_last_read_at end
    where id = p_ticket_id;
  if p_send_email and v_author.is_admin then
    select u.email into v_recipient from public.users u where u.id = v_ticket.owner_user_id;
    insert into public.email_outbox (dedupe_key, kind, recipient, subject, payload)
    values ('ticket:' || p_ticket_id::text || ':message:' || v_message_id::text,
      'ticket_reply', v_recipient, 'New reply to your CandidFan support ticket',
      jsonb_build_object('ticket_id', p_ticket_id, 'message_id', v_message_id))
    on conflict (dedupe_key) do nothing;
  end if;
  return jsonb_build_object('message_id', v_message_id, 'ticket_id', p_ticket_id);
end;
$$;

create or replace function public.claim_import_item(p_worker_id text, p_lease_seconds integer default 900)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.import_items%rowtype;
begin
  select i.* into v_item
  from public.import_items i
  join public.import_jobs j on j.id = i.job_id
  where j.status in ('queued', 'scanning', 'processing')
    and not j.pause_requested
    and i.attempts < i.max_attempts
    and (i.status in ('discovered', 'queued') or (i.status = 'processing' and i.lease_until < now()))
  order by i.discovered_at
  for update of i skip locked limit 1;
  if not found then return null; end if;
  update public.import_items
    set status = 'processing', worker_id = p_worker_id, attempts = attempts + 1,
        lease_until = now() + make_interval(secs => greatest(60, least(p_lease_seconds, 3600))), heartbeat_at = now(), error_message = null
    where id = v_item.id
    returning * into v_item;
  update public.import_jobs set status = 'processing', started_at = coalesce(started_at, now()), worker_id = p_worker_id where id = v_item.job_id;
  return jsonb_build_object('id', v_item.id, 'job_id', v_item.job_id, 'source_name', v_item.source_name, 'source_size_bytes', v_item.source_size_bytes, 'source_mtime_ms', v_item.source_mtime_ms, 'attempts', v_item.attempts);
end;
$$;

create or replace function public.publish_import_item(
  p_item_id uuid,
  p_worker_id text,
  p_source_key text,
  p_work_key text,
  p_source_name text,
  p_source_sha256 text,
  p_source_size_bytes bigint,
  p_source_mime text,
  p_source_duration_seconds numeric,
  p_source_codec text,
  p_output_key text,
  p_preview_key text,
  p_thumbnail_keys jsonb,
  p_duration_seconds numeric,
  p_width integer,
  p_height integer,
  p_output_size_bytes bigint,
  p_preview_size_bytes bigint,
  p_processing_version text,
  p_processing_config jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.import_items%rowtype;
  v_duplicate uuid;
  v_video_id uuid;
begin
  select * into v_item from public.import_items where id = p_item_id and worker_id = p_worker_id for update;
  if not found then raise exception using errcode = '42501', message = 'Import lease is not valid'; end if;
  select video_id into v_duplicate from public.video_assets where source_sha256 = p_source_sha256 and video_id <> coalesce(v_item.video_id, '00000000-0000-0000-0000-000000000000'::uuid) limit 1;
  if v_duplicate is not null then
    update public.import_items set status = 'duplicate', video_id = v_duplicate, source_sha256 = p_source_sha256, safe_to_delete = true, lease_until = null where id = p_item_id;
    return jsonb_build_object('status', 'duplicate', 'video_id', v_duplicate);
  end if;
  v_video_id := coalesce(v_item.video_id, gen_random_uuid());
  insert into public.videos (id, title, tags, status, duration_seconds, width, height, public_preview_key, public_thumbnail_key, full_asset_key, source_sha256, processing_version, published_at)
  values (v_video_id, regexp_replace(replace(regexp_replace(regexp_replace(p_source_name, '^.*/', ''), '\.[^.]+$', '', 'g'), '-', ' '), '[[:space:]]+', ' ', 'g'), '{}', 'published', p_duration_seconds, p_width, p_height, p_preview_key, p_thumbnail_keys->>'medium', p_output_key, p_source_sha256, p_processing_version, now())
  on conflict (id) do update set status = 'published', duration_seconds = excluded.duration_seconds, width = excluded.width, height = excluded.height, public_preview_key = excluded.public_preview_key, public_thumbnail_key = excluded.public_thumbnail_key, full_asset_key = excluded.full_asset_key, source_sha256 = excluded.source_sha256, processing_version = excluded.processing_version, published_at = coalesce(public.videos.published_at, excluded.published_at);
  insert into public.video_assets (video_id, source_key, work_key, source_name, source_sha256, source_size_bytes, source_mime, source_duration_seconds, source_codec, output_size_bytes, preview_size_bytes, thumbnail_keys, processing_config, safe_to_delete)
  values (v_video_id, p_source_key, p_work_key, p_source_name, p_source_sha256, p_source_size_bytes, p_source_mime, p_source_duration_seconds, p_source_codec, p_output_size_bytes, p_preview_size_bytes, p_thumbnail_keys, p_processing_config, true)
  on conflict (video_id) do update set source_key = excluded.source_key, work_key = excluded.work_key, source_name = excluded.source_name, source_sha256 = excluded.source_sha256, source_size_bytes = excluded.source_size_bytes, source_mime = excluded.source_mime, source_duration_seconds = excluded.source_duration_seconds, source_codec = excluded.source_codec, output_size_bytes = excluded.output_size_bytes, preview_size_bytes = excluded.preview_size_bytes, thumbnail_keys = excluded.thumbnail_keys, processing_config = excluded.processing_config, safe_to_delete = true;
  update public.import_items set status = 'published', video_id = v_video_id, source_sha256 = p_source_sha256, copy_verified_at = now(), safe_to_delete = true, lease_until = null where id = p_item_id;
  return jsonb_build_object('status', 'published', 'video_id', v_video_id);
end;
$$;

create or replace function public.refresh_import_job_stats(p_job_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.import_jobs j set
    discovered_count = (select count(*) from public.import_items i where i.job_id = j.id),
    queued_count = (select count(*) from public.import_items i where i.job_id = j.id and i.status in ('discovered','queued')),
    processing_count = (select count(*) from public.import_items i where i.job_id = j.id and i.status = 'processing'),
    published_count = (select count(*) from public.import_items i where i.job_id = j.id and i.status = 'published'),
    duplicate_count = (select count(*) from public.import_items i where i.job_id = j.id and i.status = 'duplicate'),
    failed_count = (select count(*) from public.import_items i where i.job_id = j.id and i.status = 'failed'),
    skipped_count = (select count(*) from public.import_items i where i.job_id = j.id and i.status = 'skipped'),
    status = case when not exists (select 1 from public.import_items i where i.job_id = j.id and i.status in ('discovered','queued','processing')) then 'completed'::public.import_job_status else j.status end,
    completed_at = case when not exists (select 1 from public.import_items i where i.job_id = j.id and i.status in ('discovered','queued','processing')) then coalesce(j.completed_at, now()) else j.completed_at end
  where j.id = p_job_id;
$$;

-- Privileged RPCs are callable only by the backend's service role.
revoke execute on function public.submit_payment_request(uuid, text, integer, text) from public, anon, authenticated;
revoke execute on function public.review_payment(uuid, uuid, public.payment_status, text) from public, anon, authenticated;
revoke execute on function public.create_support_message(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.claim_import_item(text, integer) from public, anon, authenticated;
revoke execute on function public.publish_import_item(uuid, text, text, text, text, text, bigint, text, numeric, text, text, text, jsonb, numeric, integer, integer, bigint, bigint, text, jsonb) from public, anon, authenticated;
revoke execute on function public.refresh_import_job_stats(uuid) from public, anon, authenticated;
grant execute on function public.submit_payment_request(uuid, text, integer, text) to service_role;
grant execute on function public.review_payment(uuid, uuid, public.payment_status, text) to service_role;
grant execute on function public.create_support_message(uuid, uuid, text, boolean) to service_role;
grant execute on function public.claim_import_item(text, integer) to service_role;
grant execute on function public.publish_import_item(uuid, text, text, text, text, text, bigint, text, numeric, text, text, text, jsonb, numeric, integer, integer, bigint, bigint, text, jsonb) to service_role;
grant execute on function public.refresh_import_job_stats(uuid) to service_role;

revoke all on public.video_assets, public.import_jobs, public.import_items, public.audit_logs, public.email_outbox from anon, authenticated;
revoke all on public.videos from anon, authenticated;
revoke insert, update, delete on public.users from anon, authenticated;
revoke insert, update, delete on public.payment_requests from anon, authenticated;
revoke insert, update, delete on public.support_tickets, public.support_messages from anon, authenticated;
