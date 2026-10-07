alter table public.coletas
  add column collector text,
  add column items_unchanged integer not null default 0,
  add column items_rejected integer not null default 0,
  add column error_count integer not null default 0,
  add column duration_ms bigint,
  add column heartbeat_at timestamptz;

update public.coletas set collector = provider where collector is null;
alter table public.coletas alter column collector set not null;

alter table public.coletas
  add constraint coletas_items_unchanged_nonnegative check (items_unchanged >= 0),
  add constraint coletas_items_rejected_nonnegative check (items_rejected >= 0),
  add constraint coletas_error_count_nonnegative check (error_count >= 0),
  add constraint coletas_duration_nonnegative check (duration_ms is null or duration_ms >= 0);

create index coletas_collector_started_idx
  on public.coletas (collector, started_at desc);

alter table public.coletas force row level security;
revoke all on public.coletas from anon, authenticated;

create table private.collector_locks (
  collector text primary key,
  run_id uuid not null unique,
  locked_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  locked_until timestamptz not null,
  owner text
);

revoke all on private.collector_locks from public, anon, authenticated;

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
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
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
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
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
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
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

create view public.collector_health with (security_invoker = true) as
with ranked as (
  select c.*,
         row_number() over (partition by c.collector order by c.started_at desc) as row_number,
         max(c.finished_at) filter (where c.status = 'SUCCESS') over (partition by c.collector) as last_success_at
    from public.coletas c
)
select collector, provider, id as last_run_id, status as last_status,
       started_at as last_started_at, finished_at as last_finished_at,
       last_success_at, duration_ms, items_found, items_created, items_updated,
       items_unchanged, items_rejected, error_count,
       case
         when status = 'RUNNING' and heartbeat_at < now() - interval '2 hours' then 'FAILED'
         when status = 'FAILED' then 'FAILED'
         when status = 'PARTIAL' then 'DEGRADED'
         else 'HEALTHY'
       end as health_status,
       left(error_message, 500) as last_error
  from ranked
 where row_number = 1;

revoke all on public.collector_health from public, anon, authenticated;
grant select on public.collector_health to service_role;

create or replace function private.prepare_tentativa_questao() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user uuid;
  resposta_oficial char(1);
  questao_anulada boolean;
begin
  authenticated_user := auth.uid();
  if authenticated_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  new.user_id := authenticated_user;
  new.alternativa_marcada := upper(new.alternativa_marcada);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('attempt-rate:' || authenticated_user::text, 0)
  );
  if exists (
    select 1 from public.tentativas_questoes t
     where t.user_id = authenticated_user
       and t.answered_at > now() - interval '500 milliseconds'
  ) then
    raise exception 'attempt rate limit exceeded' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(authenticated_user::text || ':' || new.questao_id::text, 0)
  );
  select q.resposta, q.anulada into resposta_oficial, questao_anulada
    from public.questoes q where q.id = new.questao_id;
  if not found then raise exception 'question not found' using errcode = '23503'; end if;

  new.anulada := questao_anulada;
  new.correta := not questao_anulada and resposta_oficial = new.alternativa_marcada;
  new.numero_tentativa := coalesce((
    select max(t.numero_tentativa) + 1 from public.tentativas_questoes t
     where t.user_id = authenticated_user and t.questao_id = new.questao_id
  ), 1);
  new.answered_at := now();
  new.created_at := now();
  return new;
end;
$$;

revoke execute on function private.prepare_tentativa_questao() from public, anon, authenticated;
