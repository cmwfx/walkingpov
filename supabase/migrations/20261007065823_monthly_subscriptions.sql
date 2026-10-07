-- Additive subscription storage. Existing lifetime sources keep no expiry.
alter type public.ivg_grant_source add value if not exists 'instantvidgrab_subscription';
alter table public.ivg_access_grants add column if not exists expires_at timestamptz;
create table public.ivg_subscriptions (
  source_id text primary key check (source_id ~ '^sub_[a-f0-9]{32}$'),
  user_id uuid not null references public.users(id) on delete cascade,
  instantvidgrab_user_id text not null,
  status text not null,
  grant_state public.ivg_grant_state not null,
  paid_through timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancellation_pending boolean not null default false,
  version bigint not null check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (grant_state <> 'active' or paid_through is not null)
);
create index ivg_subscriptions_user_idx on public.ivg_subscriptions(user_id, paid_through desc);
alter table public.ivg_subscriptions enable row level security;
revoke all on public.ivg_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.ivg_subscriptions to service_role;
