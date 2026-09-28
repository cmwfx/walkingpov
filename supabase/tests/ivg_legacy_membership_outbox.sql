-- Regression check for the PL/pgSQL idempotency-key/column name collision.
-- This checks the installed function definition without reading customer data.
do $test$
declare
  function_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.ivg_enqueue_legacy_membership_outbox(uuid, character varying)'::regprocedure
  )
  into function_definition;

  if function_definition is null
     or pg_catalog.strpos(pg_catalog.lower(function_definition), 'v_idempotency_key') = 0
     or pg_catalog.strpos(pg_catalog.lower(function_definition), 'on conflict (idempotency_key) do nothing') = 0
     or function_definition ~* '\m(idempotency_key)\s+varchar' then
    raise exception 'Legacy membership outbox idempotency-key collision regression';
  end if;
end;
$test$;
