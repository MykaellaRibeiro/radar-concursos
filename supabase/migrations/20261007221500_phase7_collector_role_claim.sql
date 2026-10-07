-- PostgREST exposes current JWT claims through auth.jwt(); the legacy
-- request.jwt.claim.role setting is not populated by current Supabase APIs.
create or replace function public.begin_collector_run(
  p_collector text,
  p_provider text,
  p_ttl_seconds integer default 3600,
  p_metadata jsonb default '{}'::jsonb
)
returns table (run_status text, run_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid := gen_random_uuid();
  v_acquired uuid;
  v_ttl integer := greatest(60, least(coalesce(p_ttl_seconds, 3600), 21600));
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'collector operations require service_role' using errcode = '42501';
  end if;
  if nullif(btrim(p_collector), '') is null or nullif(btrim(p_provider), '') is null then
    raise exception 'collector and provider are required' using errcode = '22023';
  end if;

  insert into private.collector_locks (collector, run_id, locked_until, owner)
  values (p_collector, v_run_id, now() + make_interval(secs => v_ttl), p_metadata ->> 'owner')
  on conflict (collector) do update
    set run_id = excluded.run_id,
        locked_at = now(),
        heartbeat_at = now(),
        locked_until = excluded.locked_until,
        owner = excluded.owner
    where private.collector_locks.locked_until <= now()
  returning private.collector_locks.run_id into v_acquired;

  if v_acquired is null then
    return query select 'already_running'::text, null::uuid;
    return;
  end if;

  insert into public.coletas (
    id, provider, collector, started_at, heartbeat_at, status, metadata
  ) values (
    v_run_id, p_provider, p_collector, now(), now(), 'RUNNING', coalesce(p_metadata, '{}'::jsonb)
  );

  return query select 'acquired'::text, v_run_id;
end;
$$;

create or replace function public.heartbeat_collector_run(
  p_run_id uuid,
  p_ttl_seconds integer default 3600
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
  v_ttl integer := greatest(60, least(coalesce(p_ttl_seconds, 3600), 21600));
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'collector operations require service_role' using errcode = '42501';
  end if;

  update private.collector_locks
     set heartbeat_at = now(), locked_until = now() + make_interval(secs => v_ttl)
   where run_id = p_run_id;
  get diagnostics v_updated = row_count;

  if v_updated = 1 then
    update public.coletas set heartbeat_at = now() where id = p_run_id and status = 'RUNNING';
  end if;
  return v_updated = 1;
end;
$$;

create or replace function public.finish_collector_run(
  p_run_id uuid,
  p_status text,
  p_items_found integer default 0,
  p_items_created integer default 0,
  p_items_updated integer default 0,
  p_items_unchanged integer default 0,
  p_items_rejected integer default 0,
  p_error_count integer default 0,
  p_error_message text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_started_at timestamptz;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'collector operations require service_role' using errcode = '42501';
  end if;
  if p_status not in ('SUCCESS', 'PARTIAL', 'FAILED') then
    raise exception 'invalid collector status' using errcode = '22023';
  end if;

  select started_at into v_started_at from public.coletas where id = p_run_id for update;
  if v_started_at is null then return false; end if;

  update public.coletas
     set finished_at = now(),
         heartbeat_at = now(),
         status = p_status,
         items_found = greatest(coalesce(p_items_found, 0), 0),
         items_created = greatest(coalesce(p_items_created, 0), 0),
         items_updated = greatest(coalesce(p_items_updated, 0), 0),
         items_unchanged = greatest(coalesce(p_items_unchanged, 0), 0),
         items_rejected = greatest(coalesce(p_items_rejected, 0), 0),
         error_count = greatest(coalesce(p_error_count, 0), 0),
         duration_ms = greatest((extract(epoch from (now() - v_started_at)) * 1000)::bigint, 0),
         error_message = nullif(left(coalesce(p_error_message, ''), 2000), ''),
         metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
   where id = p_run_id;

  delete from private.collector_locks where run_id = p_run_id;
  return true;
end;
$$;

revoke all on function public.begin_collector_run(text, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.heartbeat_collector_run(uuid, integer) from public, anon, authenticated;
revoke all on function public.finish_collector_run(uuid, text, integer, integer, integer, integer, integer, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.begin_collector_run(text, text, integer, jsonb) to service_role;
grant execute on function public.heartbeat_collector_run(uuid, integer) to service_role;
grant execute on function public.finish_collector_run(uuid, text, integer, integer, integer, integer, integer, integer, text, jsonb) to service_role;
