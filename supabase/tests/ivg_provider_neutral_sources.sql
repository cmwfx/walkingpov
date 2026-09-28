-- Run only after the provider-neutral source migration is applied.
-- Checks schema metadata, not customer or payment rows.
do $test$
declare
  inbox_source_constraint text;
begin
  if exists (
    select 1
    from pg_catalog.pg_enum as enum_value
    join pg_catalog.pg_type as enum_type on enum_type.oid = enum_value.enumtypid
    join pg_catalog.pg_namespace as enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'ivg_grant_source'
      and enum_value.enumlabel not in (
        'legacy_membership',
        'legacy_payment_request',
        'instantvidgrab_order',
        'complimentary',
        'manual'
      )
  ) then
    raise exception 'WalkingPOV grant sources contain a non-product-neutral value';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_enum as enum_value
    join pg_catalog.pg_type as enum_type on enum_type.oid = enum_value.enumtypid
    join pg_catalog.pg_namespace as enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'ivg_grant_source'
      and enum_value.enumlabel = 'instantvidgrab_order'
  ) then
    raise exception 'Provider-neutral InstantVidGrab grant source is missing';
  end if;

  select pg_catalog.pg_get_constraintdef(constraint_row.oid)
  into inbox_source_constraint
  from pg_catalog.pg_constraint as constraint_row
  where constraint_row.conrelid = 'public.ivg_integration_inbox'::regclass
    and constraint_row.conname = 'ivg_integration_inbox_source_check';

  if inbox_source_constraint is null
     or pg_catalog.strpos(pg_catalog.lower(inbox_source_constraint), 'instantvidgrab') = 0
     or pg_catalog.strpos(pg_catalog.lower(inbox_source_constraint), 'whop') > 0 then
    raise exception 'WalkingPOV integration inbox is not restricted to InstantVidGrab events';
  end if;
end;
$test$;
