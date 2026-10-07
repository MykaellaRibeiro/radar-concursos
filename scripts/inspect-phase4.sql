select jsonb_build_object(
  'columns', (
    select jsonb_agg(to_jsonb(row_data) order by row_data.table_name, row_data.ordinal_position)
    from (
      select table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('editais', 'provas', 'gabaritos', 'arquivos', 'resultados', 'fontes', 'movimentacoes')
    ) row_data
  ),
  'constraints', (
    select jsonb_agg(to_jsonb(row_data) order by row_data.table_name, row_data.conname)
    from (
      select c.relname as table_name, con.conname, con.contype, pg_get_constraintdef(con.oid) as definition
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in ('editais', 'provas', 'gabaritos', 'arquivos', 'resultados', 'fontes', 'movimentacoes')
    ) row_data
  ),
  'rls', (
    select jsonb_agg(to_jsonb(row_data) order by row_data.table_name)
    from (
      select c.relname as table_name, c.relrowsecurity as enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname in ('editais', 'provas', 'gabaritos', 'arquivos', 'resultados', 'fontes', 'movimentacoes')
    ) row_data
  ),
  'policies', (
    select jsonb_agg(to_jsonb(row_data) order by row_data.schemaname, row_data.tablename, row_data.policyname)
    from (
      select schemaname, tablename, policyname, roles, cmd, qual, with_check
      from pg_policies
      where (schemaname = 'public' and tablename in ('editais', 'provas', 'gabaritos', 'arquivos', 'resultados', 'fontes', 'movimentacoes'))
         or (schemaname = 'storage' and tablename = 'objects')
    ) row_data
  ),
  'buckets', (
    select jsonb_agg(to_jsonb(row_data) order by row_data.id)
    from (
      select id, name, public, file_size_limit, allowed_mime_types, created_at
      from storage.buckets
    ) row_data
  ),
  'counts', jsonb_build_object(
    'editais', (select count(*) from public.editais),
    'provas', (select count(*) from public.provas),
    'gabaritos', (select count(*) from public.gabaritos),
    'arquivos', (select count(*) from public.arquivos),
    'resultados', (select count(*) from public.resultados)
  )
) as inventory;
