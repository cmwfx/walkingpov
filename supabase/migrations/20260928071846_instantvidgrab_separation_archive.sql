-- Private, in-database rollback archive created immediately before disconnecting
-- InstantVidGrab. Contains only membership and IVG integration state plus the
-- definitions whose behavior is changed by the companion cutover migration.
create schema candidfan_rollback_20260928_ivg;
revoke all on schema candidfan_rollback_20260928_ivg from public, anon, authenticated;
grant usage on schema candidfan_rollback_20260928_ivg to service_role;

create table candidfan_rollback_20260928_ivg.membership_status as
select id, membership_status::text as membership_status, updated_at
from public.users;

create table candidfan_rollback_20260928_ivg.access_grants as
table public.ivg_access_grants;
create table candidfan_rollback_20260928_ivg.identity_links as
table public.ivg_identity_links;
create table candidfan_rollback_20260928_ivg.auth_codes as
table public.ivg_auth_codes;
create table candidfan_rollback_20260928_ivg.integration_inbox as
table public.ivg_integration_inbox;
create table candidfan_rollback_20260928_ivg.integration_outbox as
table public.ivg_integration_outbox;

create table candidfan_rollback_20260928_ivg.routines as
select p.oid::regprocedure::text as routine,
       pg_catalog.pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc as p
join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname like 'ivg_%'
    or p.proname in ('apply_ivg_entitlement_event', 'recompute_ivg_membership',
                     'review_payment_request', 'submit_payment_request'));

create table candidfan_rollback_20260928_ivg.triggers as
select c.relname as table_name,
       t.tgname as trigger_name,
       pg_catalog.pg_get_triggerdef(t.oid) as definition
from pg_catalog.pg_trigger as t
join pg_catalog.pg_class as c on c.oid = t.tgrelid
join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and t.tgname like 'ivg_%';

create table candidfan_rollback_20260928_ivg.manifest (
  archived_at timestamptz not null default pg_catalog.now(),
  migration_version text not null,
  row_counts jsonb not null
);

insert into candidfan_rollback_20260928_ivg.manifest (migration_version, row_counts)
values (
  '20260928071846_instantvidgrab_separation_archive',
  pg_catalog.jsonb_build_object(
    'membership_status', (select count(*) from candidfan_rollback_20260928_ivg.membership_status),
    'access_grants', (select count(*) from candidfan_rollback_20260928_ivg.access_grants),
    'identity_links', (select count(*) from candidfan_rollback_20260928_ivg.identity_links),
    'auth_codes', (select count(*) from candidfan_rollback_20260928_ivg.auth_codes),
    'integration_inbox', (select count(*) from candidfan_rollback_20260928_ivg.integration_inbox),
    'integration_outbox', (select count(*) from candidfan_rollback_20260928_ivg.integration_outbox),
    'routines', (select count(*) from candidfan_rollback_20260928_ivg.routines),
    'triggers', (select count(*) from candidfan_rollback_20260928_ivg.triggers)
  )
);

grant select on all tables in schema candidfan_rollback_20260928_ivg to service_role;
comment on schema candidfan_rollback_20260928_ivg is
  'Restricted pre-cutover rollback archive; do not expose via the Data API or application routes.';
