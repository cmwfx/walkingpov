-- Read-only catalog/privilege assertions. Safe to run against a test or live
-- project after the migration; it does not inspect application row contents.
do $test$
declare
  table_name text;
  target_table text;
begin
  foreach table_name in array array[
    'ivg_access_grants',
    'ivg_identity_links',
    'ivg_auth_codes',
    'ivg_integration_inbox',
    'ivg_integration_outbox',
    'ivg_internal_nonces'
  ] loop
    target_table := format('public.%I', table_name);

    if not exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = table_name
        and relation.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on %', target_table;
    end if;

    if has_table_privilege('anon', target_table, 'SELECT')
      or has_table_privilege('anon', target_table, 'INSERT')
      or has_table_privilege('anon', target_table, 'UPDATE')
      or has_table_privilege('anon', target_table, 'DELETE')
      or has_any_column_privilege('anon', target_table, 'SELECT')
      or has_any_column_privilege('anon', target_table, 'INSERT')
      or has_any_column_privilege('anon', target_table, 'UPDATE')
      or has_table_privilege('authenticated', target_table, 'SELECT')
      or has_table_privilege('authenticated', target_table, 'INSERT')
      or has_table_privilege('authenticated', target_table, 'UPDATE')
      or has_table_privilege('authenticated', target_table, 'DELETE')
      or has_any_column_privilege('authenticated', target_table, 'SELECT')
      or has_any_column_privilege('authenticated', target_table, 'INSERT')
      or has_any_column_privilege('authenticated', target_table, 'UPDATE') then
      raise exception 'A browser role has direct privileges on %', target_table;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_policies as policy
      where policy.schemaname = 'public'
        and policy.tablename = table_name
        and (
          'anon'::name = any(policy.roles)
          or 'authenticated'::name = any(policy.roles)
          or 'public'::name = any(policy.roles)
        )
    ) then
      raise exception 'A browser role has a policy on %', target_table;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_policies as policy
      where policy.schemaname = 'public'
        and policy.tablename = table_name
        and 'service_role'::name = any(policy.roles)
    ) then
      raise exception 'The server role is missing an RLS policy on %', target_table;
    end if;

    if not has_table_privilege('service_role', target_table, 'SELECT')
      or not has_table_privilege('service_role', target_table, 'INSERT')
      or not has_table_privilege('service_role', target_table, 'UPDATE')
      or not has_table_privilege('service_role', target_table, 'DELETE') then
      raise exception 'The server role is missing required privileges on %', target_table;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.recompute_ivg_membership(uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.recompute_ivg_membership(uuid)', 'EXECUTE') then
    raise exception 'A browser role can execute the membership recomputation function';
  end if;

  if has_function_privilege('anon', 'public.apply_ivg_entitlement_event(varchar, bytea, uuid, public.ivg_grant_source, varchar, public.ivg_grant_state, bigint)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.apply_ivg_entitlement_event(varchar, bytea, uuid, public.ivg_grant_source, varchar, public.ivg_grant_state, bigint)', 'EXECUTE') then
    raise exception 'A browser role can execute the internal entitlement event function';
  end if;

  if not has_function_privilege('service_role', 'public.recompute_ivg_membership(uuid)', 'EXECUTE') then
    raise exception 'The server role cannot execute the membership recomputation function';
  end if;

  if not has_function_privilege('service_role', 'public.apply_ivg_entitlement_event(varchar, bytea, uuid, public.ivg_grant_source, varchar, public.ivg_grant_state, bigint)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.claim_ivg_integration_outbox(varchar, integer)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.complete_ivg_integration_outbox(uuid, uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.fail_ivg_integration_outbox(uuid, uuid, varchar, integer)', 'EXECUTE') then
    raise exception 'The server role is missing an internal integration function grant';
  end if;

  if has_function_privilege('anon', 'public.claim_ivg_integration_outbox(varchar, integer)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.claim_ivg_integration_outbox(varchar, integer)', 'EXECUTE')
    or has_function_privilege('anon', 'public.complete_ivg_integration_outbox(uuid, uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.complete_ivg_integration_outbox(uuid, uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.fail_ivg_integration_outbox(uuid, uuid, varchar, integer)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.fail_ivg_integration_outbox(uuid, uuid, varchar, integer)', 'EXECUTE') then
    raise exception 'A browser role can execute an internal integration function';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgname = 'ivg_guard_membership_downgrade'
      and not tgisinternal
  ) then
    raise exception 'The independent-grant membership guard is missing';
  end if;

  if has_table_privilege('anon', 'public.users', 'UPDATE')
    or has_column_privilege('anon', 'public.users', 'membership_status', 'UPDATE')
    or has_column_privilege('anon', 'public.users', 'is_admin', 'UPDATE')
    or has_table_privilege('authenticated', 'public.users', 'UPDATE')
    or has_column_privilege('authenticated', 'public.users', 'membership_status', 'UPDATE')
    or has_column_privilege('authenticated', 'public.users', 'is_admin', 'UPDATE') then
    raise exception 'A browser role can modify legacy membership or administrator fields';
  end if;
end;
$test$;
