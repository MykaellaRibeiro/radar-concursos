select jsonb_pretty(jsonb_build_object(
  'public_tables', (
    select jsonb_agg(c.relname order by c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ),
  'public_views', (
    select jsonb_agg(viewname order by viewname)
    from pg_views
    where schemaname = 'public'
  ),
  'public_functions', (
    select coalesce(jsonb_agg(p.proname order by p.proname), '[]'::jsonb)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  ),
  'relevant_triggers', (
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'trigger', t.tgname,
      'function', pn.nspname || '.' || p.proname
    ) order by n.nspname, c.relname, t.tgname)
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace pn on pn.oid = p.pronamespace
    where not t.tgisinternal and n.nspname in ('public', 'auth')
  ),
  'rls', (
    select jsonb_build_object(
      'tables', count(*),
      'enabled', count(*) filter (where c.relrowsecurity),
      'forced', count(*) filter (where c.relforcerowsecurity),
      'policies', (select count(*) from pg_policies where schemaname = 'public')
    )
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ),
  'row_counts', jsonb_build_object(
    'profiles', (select count(*) from public.profiles),
    'orgaos', (select count(*) from public.orgaos),
    'cargos', (select count(*) from public.cargos),
    'bancas', (select count(*) from public.bancas),
    'concursos', (select count(*) from public.concursos),
    'concursos_cargos', (select count(*) from public.concursos_cargos),
    'fontes', (select count(*) from public.fontes),
    'concurso_fontes', (select count(*) from public.concurso_fontes),
    'movimentacoes', (select count(*) from public.movimentacoes),
    'movimentacao_fontes', (select count(*) from public.movimentacao_fontes),
    'coletas', (select count(*) from public.coletas),
    'alertas', (select count(*) from public.alertas),
    'concursos_seguidos', (select count(*) from public.concursos_seguidos),
    'notificacoes', (select count(*) from public.notificacoes)
  ),
  'contest_statuses', (
    select jsonb_object_agg(status, amount)
    from (select status::text, count(*) as amount from public.concursos group by status) s
  ),
  'auth_users', (
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'email', email,
      'created_at', created_at,
      'last_sign_in_at', last_sign_in_at
    ) order by created_at)
    from auth.users
  ),
  'collections', (
    select jsonb_agg(to_jsonb(c) order by started_at)
    from (
      select id, provider, status, items_found, items_created, items_updated,
             metadata ->> 'normalized' as items_normalized,
             metadata ->> 'discarded' as items_discarded,
             metadata ->> 'unchanged' as items_unchanged,
             started_at, finished_at, error_message
      from public.coletas
    ) c
  ),
  'migrations', (
    select jsonb_agg(version order by version)
    from supabase_migrations.schema_migrations
  ),
  'legacy_objects_remaining', (
    select coalesce(jsonb_agg(tablename order by tablename), '[]'::jsonb)
    from pg_tables
    where schemaname = 'public'
      and tablename = any(array[
        'areas', 'cp_attempts', 'cp_daily_sessions', 'cp_learning_units',
        'cp_news_items', 'cp_profiles', 'cp_progress', 'media_items',
        'tasks', 'time_entries', 'whatsapp_messages'
      ])
  ),
  'legacy_cron_jobs_preserved', (
    select coalesce(jsonb_agg(jsonb_build_object('jobid', jobid, 'jobname', jobname, 'schedule', schedule)), '[]'::jsonb)
    from cron.job
    where jobname like 'codepulse%'
  )
));
