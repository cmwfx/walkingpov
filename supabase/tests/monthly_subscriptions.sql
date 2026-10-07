-- Synthetic account and all events are rolled back. No customer data is read.
begin;
do $test$
declare
  uid uuid := gen_random_uuid();
  source text := 'sub_' || replace(gen_random_uuid()::text,'-','');
  event text;
  version bigint;
  queued_before bigint;
  hash bytea := decode(repeat('ab',32),'hex');
begin
  if has_table_privilege('anon','public.ivg_subscriptions','select')
    or has_table_privilege('authenticated','public.ivg_subscriptions','select') then
    raise exception 'Subscription mirror is exposed to browser roles';
  end if;
  if has_function_privilege('anon','public.apply_ivg_subscription_event(text,bytea,uuid,text,text,public.ivg_grant_state,bigint,timestamptz,timestamptz,text,boolean,boolean)','execute')
    or has_function_privilege('authenticated','public.apply_ivg_subscription_event(text,bytea,uuid,text,text,public.ivg_grant_state,bigint,timestamptz,timestamptz,text,boolean,boolean)','execute') then
    raise exception 'Browser can mutate subscription entitlements';
  end if;
  insert into auth.users(id,email) values(uid,uid::text || '@example.invalid');
  insert into public.users(id,email) values(uid,uid::text || '@example.invalid') on conflict(id) do nothing;
  insert into public.ivg_identity_links(walkingpov_user_id,instantvidgrab_user_id,state) values(uid,'monthly-synthetic-user','verified');
  select count(*) into queued_before from public.ivg_integration_outbox where aggregate_id=uid::text and kind='legacy_membership_snapshot';
  event := 'ivg:subscription:' || source || ':1';
  version := public.apply_ivg_subscription_event(event,hash,uid,'monthly-synthetic-user',source,'active',1,now()+interval '30 days',now()+interval '30 days','active',false,false);
  if version<>1 or (select membership_status from public.users where id=uid)<>'premium' then raise exception 'Initial payment did not activate Premium'; end if;
  version := public.apply_ivg_subscription_event(event,hash,uid,'monthly-synthetic-user',source,'active',1,now()+interval '30 days',now()+interval '30 days','active',false,false);
  if version<>1 then raise exception 'Replay changed version'; end if;
  if (select count(*) from public.ivg_integration_outbox where aggregate_id=uid::text and kind='legacy_membership_snapshot') <> queued_before then raise exception 'Monthly access leaked into permanent legacy synchronization'; end if;
  version := public.apply_ivg_subscription_event('ivg:subscription:' || source || ':2',hash,uid,'monthly-synthetic-user',source,'active',2,now()+interval '30 days',now()+interval '30 days','active',true,false);
  if (select membership_status from public.users where id=uid)<>'premium' then raise exception 'Cancellation removed paid access prematurely'; end if;
  version := public.apply_ivg_subscription_event('ivg:subscription:' || source || ':3',hash,uid,'monthly-synthetic-user',source,'active',3,now()-interval '1 second',now()-interval '1 second','active',true,false);
  if (select membership_status from public.users where id=uid)<>'free' then raise exception 'Expired active grant still provides Premium'; end if;
  insert into public.ivg_access_grants(user_id,product,source_type,source_id,state,version) values(uid,'walkingpov','manual','man_'||replace(gen_random_uuid()::text,'-',''),'active',1);
  version := public.apply_ivg_subscription_event('ivg:subscription:' || source || ':4',hash,uid,'monthly-synthetic-user',source,'revoked',4,now()-interval '1 second',now()-interval '1 second','expired',true,false);
  if (select membership_status from public.users where id=uid)<>'premium' then raise exception 'Subscription expiry revoked independent permanent access'; end if;
  version := public.apply_ivg_subscription_event('ivg:subscription:' || source || ':2',hash,uid,'monthly-synthetic-user',source,'active',2,now()+interval '30 days',now()+interval '30 days','active',false,false);
  if version<>4 or (select s.version from public.ivg_subscriptions s where source_id=source)<>4 then raise exception 'Stale event replaced current subscription'; end if;
end;
$test$;
rollback;
