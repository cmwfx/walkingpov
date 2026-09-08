-- Keep internal tables and service-only RPCs unreachable from browser roles.
revoke all on function public.handle_new_user() from anon, authenticated, public;
revoke all on function public.submit_payment_request(uuid, text) from anon, authenticated, public;
revoke all on function public.review_payment_request(uuid, uuid, public.payment_status, text) from anon, authenticated, public;
revoke all on function public.create_support_ticket(uuid, text, text) from anon, authenticated, public;
revoke all on function public.add_support_message(uuid, uuid, text, boolean) from anon, authenticated, public;
revoke all on function public.publish_import_item(uuid, bigint) from anon, authenticated, public;
revoke all on function public.claim_import_item(uuid, text, text, bigint, uuid, uuid) from anon, authenticated, public;
revoke all on function public.record_import_failure(uuid, text) from anon, authenticated, public;
revoke all on function public.claim_next_email(text) from anon, authenticated, public;
revoke all on function public.mark_email_sent(uuid) from anon, authenticated, public;
revoke all on function public.mark_email_failed(uuid, text) from anon, authenticated, public;

create policy internal_users_only_media on public.media_assets for all to anon, authenticated using (false) with check (false);
create policy internal_users_only_payments on public.payment_requests for all to anon, authenticated using (false) with check (false);
create policy internal_users_only_tickets on public.support_tickets for all to anon, authenticated using (false) with check (false);
create policy internal_users_only_messages on public.support_messages for all to anon, authenticated using (false) with check (false);
create policy internal_users_only_outbox on public.email_outbox for all to anon, authenticated using (false) with check (false);
create policy internal_users_only_import_jobs on public.import_jobs for all to anon, authenticated using (false) with check (false);
create policy internal_users_only_import_items on public.import_items for all to anon, authenticated using (false) with check (false);
create policy internal_users_only_audit on public.audit_logs for all to anon, authenticated using (false) with check (false);

create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id);
create index if not exists payment_requests_reviewed_by_idx on public.payment_requests(reviewed_by);
create index if not exists support_messages_author_idx on public.support_messages(author_id);
create index if not exists videos_created_by_idx on public.videos(created_by);
