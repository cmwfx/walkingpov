alter table public.videos
  add column if not exists is_featured boolean not null default false;

create index if not exists videos_featured_created_idx
  on public.videos (is_featured desc, created_at desc)
  where status = 'ready';

create table if not exists public.support_ticket_reads (
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (ticket_id, user_id)
);

create index if not exists support_ticket_reads_user_idx
  on public.support_ticket_reads(user_id, last_read_at desc);

alter table public.support_ticket_reads enable row level security;

revoke all on table public.support_ticket_reads from anon, authenticated;

create policy internal_users_only_ticket_reads
  on public.support_ticket_reads
  for all to anon, authenticated
  using (false)
  with check (false);
