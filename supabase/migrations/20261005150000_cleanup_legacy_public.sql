-- Controlled cleanup of the retired applications that previously shared this
-- project's public schema. Supabase-managed schemas and extensions are not
-- changed by this migration.

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.cp_attempts cascade;
drop table if exists public.cp_progress cascade;
drop table if exists public.cp_daily_sessions cascade;
drop table if exists public.cp_learning_units cascade;
drop table if exists public.cp_news_items cascade;
drop table if exists public.cp_profiles cascade;
drop table if exists public.whatsapp_messages cascade;
drop table if exists public.time_entries cascade;
drop table if exists public.tasks cascade;
drop table if exists public.media_items cascade;
drop table if exists public.areas cascade;
drop table if exists public.profiles cascade;

drop function if exists public._productivity_report(uuid, date, date) cascade;
drop function if exists public.complete_task(uuid) cascade;
drop function if exists public.fmt_seconds(integer) cascade;
drop function if exists public.get_productivity_report(date, date) cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.meuhub_tz() cascade;
drop function if exists public.reclassify_inbox_item(uuid, uuid) cascade;
drop function if exists public.reopen_task(uuid) cascade;
drop function if exists public.seed_default_areas() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.start_timer(uuid) cascade;
drop function if exists public.stop_timer() cascade;
