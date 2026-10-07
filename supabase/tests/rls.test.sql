begin;
select plan(9);

select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'profiles'), 'profiles has RLS enabled');
select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'alertas'), 'alertas has RLS enabled');
select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'concursos_seguidos'), 'concursos_seguidos has RLS enabled');
select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'notificacoes'), 'notificacoes has RLS enabled');

select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'profiles'), 2, 'profiles has select and update policies');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'alertas'), 4, 'alertas has explicit CRUD policies');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'concursos_seguidos'), 4, 'follows has explicit CRUD policies');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'notificacoes'), 3, 'notifications has explicit select, update and delete policies');
select is((select count(*)::integer from information_schema.role_table_grants where table_schema = 'public' and table_name = 'coletas' and grantee in ('anon', 'authenticated')), 0, 'collector logs are not granted to browser roles');

select * from finish();
rollback;
